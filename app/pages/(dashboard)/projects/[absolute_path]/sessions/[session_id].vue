<script setup lang="ts">
import { useClaudeWebSocket } from '~/composables/useClaudeWebSocket';
import type { ClaudeConfig } from '~/components/claude/ClaudeConfigPanel.vue';
import type { GetClaudeProjectsByAbsolutePathSessionsBySessionIdMessagesResponses } from '~/api-client';
import { useSelectedProjectStore } from '~/composables/stores/useSelectedProjectStore';

definePageMeta({
    layout: 'dashboard',
    // Re-key on the full path so Nuxt mounts a fresh instance when switching sessions
    // (or going from /new to the saved id). Without this the component is reused and
    // keeps the previous session's state/history.
    key: (route) => route.fullPath,
});

useSeoMeta({
    title: 'Session | MindCode',
    description: 'Claude Code session'
});

// ── Route params ────────────────────────────────────────────────

const route = useRoute();
const absolute_path = safeDecodeURIComponent(route.params.absolute_path as string);
const session_id = route.params.session_id as string;
const isNewSession = session_id === 'new';

// ── WebSocket ───────────────────────────────────────────────────

const ws = useClaudeWebSocket();

// ── Chat state ──────────────────────────────────────────────────

interface ToolCall {
    name: string;
    input: Record<string, any>;
    tool_use_id: string;
    result?: string;
    isError?: boolean;
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    id: string | number;
    toolCalls?: ToolCall[];
    thinking?: string;
    isStreaming?: boolean;
    /** True when the user message is a slash-command invocation (rendered as a chip). */
    isCommand?: boolean;
}

const messages = ref<ChatMessage[]>([]);
const rawOutput = ref<string[]>([]);
const inputText = ref('');
const processing = ref(false);
// Reactive connection state straight from the socket, so a mid-session drop is reflected
// in the header/input instead of staying stuck on "Connected".
const connected = ws.connected;
const errorMessage = ref<string | null>(null);
const activeSessionId = ref<string | null>(null);
const historyLoaded = ref(false);
const loadingHistory = ref(true);

// ── Layout state ────────────────────────────────────────────────

const configOpen = ref(false);
const reviewOpen = ref(false);

// ── Config state ─────────────────────────────────────────────────

const claudeConfig = ref<ClaudeConfig>({
    model: 'sonnet',
    effort: 'max',
    thinking: true,
    autoFlag: true,
    editAuto: true,
});

// ── Review panel state ───────────────────────────────────────────

const fileChanges = ref<Array<{
    file: string;
    toolName: string;
    added?: number;
    removed?: number;
}>>([]);

// ── Attachments ──────────────────────────────────────────────────

interface PendingAttachment {
    name: string;
    mediaType: string;
    data: string; // base64
    isImage: boolean;
    size: number;
}

const attachments = ref<PendingAttachment[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.slice(result.indexOf(',') + 1)); // strip "data:...;base64," prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function onFilesSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    for (const file of Array.from(input.files || [])) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
            errorMessage.value = `"${file.name}" is too large (max 10 MB).`;
            continue;
        }
        try {
            attachments.value.push({
                name: file.name,
                mediaType: file.type || 'application/octet-stream',
                data: await fileToBase64(file),
                isImage: file.type.startsWith('image/'),
                size: file.size,
            });
        } catch {
            errorMessage.value = `Failed to read "${file.name}".`;
        }
    }
    input.value = ''; // allow re-selecting the same file
}

function removeAttachment(index: number) {
    attachments.value.splice(index, 1);
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Session usage ────────────────────────────────────────────────
// Keyed by the resolved session id (in a module-level store) so it survives the page
// remount that happens when a new session navigates to its saved URL.

const usageStore = useSessionUsage();
const usageKey = computed(() => activeSessionId.value || (isNewSession ? null : session_id));
const sessionUsage = computed(() => usageStore.get(usageKey.value));

// ── Load existing messages ──────────────────────────────────────

async function loadSessionHistory() {
    if (isNewSession) {
        loadingHistory.value = false;
        historyLoaded.value = true;
        return;
    }

    loadingHistory.value = true;
    try {
        const result = await useAPI((api) => api.getClaudeProjectsByAbsolutePathSessionsBySessionIdMessages({
            path: {
                absolute_path: encodeURIComponent(absolute_path),
                session_id,
            }
        }));

        if (result.success) {
            const history = result.data as GetClaudeProjectsByAbsolutePathSessionsBySessionIdMessagesResponses['200']['data'];
            const toolResults = collectToolResults(history as any[]);
            messages.value = (history as any[])
                .map((entry, i) => mapHistoryEntry(entry, i, toolResults))
                .filter((m): m is ChatMessage => m !== null);
        }
    } catch (err: any) {
        console.error('Failed to load session history:', err);
    } finally {
        loadingHistory.value = false;
        historyLoaded.value = true;
    }
}

function extractToolResultText(content: any): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join('');
    }
    return '';
}

// Tool results arrive as separate `user` entries (content blocks of type tool_result).
// Index them by tool_use_id so they can be attached to the originating tool call.
function collectToolResults(history: any[]): Record<string, { content: string; isError: boolean }> {
    const map: Record<string, { content: string; isError: boolean }> = {};
    for (const entry of history) {
        if (entry.type !== 'user' || !Array.isArray(entry.message?.content)) continue;
        for (const part of entry.message.content) {
            if (part.type === 'tool_result' && part.tool_use_id) {
                map[part.tool_use_id] = {
                    content: extractToolResultText(part.content),
                    isError: !!part.is_error,
                };
            }
        }
    }
    return map;
}

// Session transcripts store slash-command invocations and various injected events as
// raw pseudo-XML "user" messages. Turn commands into a clean "/cmd args" chip and hide
// the injected noise (command stdout, task notifications, system reminders, caveats).
function formatUserContent(raw: string): { content: string; isCommand: boolean } | null {
    const text = raw.trim();
    if (!text) return null;

    const nameMatch = text.match(/<command-name>\s*\/?\s*([^<\s]+)\s*<\/command-name>/);
    if (nameMatch) {
        const argsMatch = text.match(/<command-args>([\s\S]*?)<\/command-args>/);
        const args = (argsMatch?.[1] || '').trim();
        return { content: `/${nameMatch[1]}${args ? ' ' + args : ''}`, isCommand: true };
    }

    const NOISE = ["task-notification", "local-command-stdout", "local-command-caveat", "system-reminder"];
    if (text.startsWith("[SYSTEM NOTIFICATION") || NOISE.some(t => text.startsWith(`<${t}>`) || text.startsWith(`[${t}]`))) {
        return null;
    }

    // The SDK injects this marker into transcripts when a turn ends; don't show it as a user message.
    if (/^\[Request interrupted by user[^\]]*\]/.test(text)) {
        return null;
    }

    const cleaned = text
        .replace(/<\/?system-reminder[\s\S]*?<\/system-reminder>/gi, "")
        .replace(/<\/?(command-name|command-message|command-args|local-command-stdout|local-command-caveat)>/g, "")
        .replace(/\<\/?ide_[^\>\s]+>(?:[\s\S]*?\<\/ide_[^\>\s]+>)?/g, "")
        .trim();
    if (!cleaned) return null;
    return { content: cleaned, isCommand: false };
}

function mapHistoryEntry(
    entry: any,
    index: number,
    toolResults: Record<string, { content: string; isError: boolean }>
): ChatMessage | null {
    if (entry.type === 'user') {
        const raw = entry.message?.content;
        const text = typeof raw === 'string'
            ? raw
            : Array.isArray(raw)
                ? raw.filter((p: any) => p.type === 'text').map((p: any) => p.text || '').join('')
                : '';
        // Tool-result echoes and injected noise resolve to null and are dropped.
        const formatted = formatUserContent(text);
        if (!formatted) return null;
        return { role: 'user', content: formatted.content, id: entry.uuid || index, isCommand: formatted.isCommand };
    }

    if (entry.type === 'assistant') {
        const msg = entry.message;
        let content = '';
        const toolCalls: ToolCall[] = [];
        let thinking = '';

        if (msg?.content && Array.isArray(msg.content)) {
            for (const part of msg.content) {
                if (part.type === 'text') {
                    content += part.text;
                } else if (part.type === 'thinking') {
                    thinking += part.thinking;
                } else if (part.type === 'tool_use') {
                    const res = toolResults[part.id];
                    toolCalls.push({
                        name: part.name,
                        input: part.input,
                        tool_use_id: part.id,
                        result: res?.content || undefined,
                        isError: res?.isError || undefined,
                    });
                }
            }
        }

        // Drop assistant entries that carry no visible content at all.
        if (!content.trim() && !thinking.trim() && toolCalls.length === 0) return null;

        return {
            role: 'assistant',
            content,
            id: entry.uuid || index,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            thinking: thinking || undefined,
        };
    }

    return null;
}

// ── Connect WebSocket on mount ──────────────────────────────────

onMounted(async () => {
    await loadSessionHistory();

    try {
        await ws.connect();

        // Fetch slash commands
        ws.fetchSlashCommands().catch(() => {});

        // Don't auto-resume — wait for user to type something
    } catch (err: any) {
        errorMessage.value = err.message || 'Failed to connect to Claude Code server';
    }
});

// Surface socket-level errors (e.g. a mid-session drop) into the error banner.
watch(ws.error, (e) => {
    if (e) {
        errorMessage.value = e;
        processing.value = false;
    }
});

// ── WebSocket event handler ─────────────────────────────────────

ws.onEvent(async (event) => {
    switch (event.type) {
        case 'delta':
            const last = messages.value[messages.value.length - 1];
            if (last?.role === 'assistant' && last.isStreaming) {
                last.content += event.content;
            } else {
                messages.value.push({
                    role: 'assistant',
                    content: event.content,
                    id: Date.now(),
                    isStreaming: true,
                });
            }
            break;

        case 'tool_use':
            const lastMsg = messages.value[messages.value.length - 1];
            if (lastMsg?.role === 'assistant') {
                if (!lastMsg.toolCalls) lastMsg.toolCalls = [];
                lastMsg.toolCalls.push({
                    name: event.name,
                    input: event.input,
                    tool_use_id: event.tool_use_id,
                });
            }

            // Track file changes for review panel
            if (event.name === 'Edit' || event.name === 'Write') {
                const file = event.input?.file_path || event.input?.path || 'unknown';
                fileChanges.value.push({
                    file,
                    toolName: event.name,
                    added: event.name === 'Edit'
                        ? (event.input?.new_string?.split('\n').length || 0)
                        : (event.input?.content?.split('\n').length || 0),
                    removed: event.name === 'Edit'
                        ? (event.input?.old_string?.split('\n').length || 0)
                        : 0,
                });
            }
            break;

        case 'tool_use_summary': {
            // Fold the summary back into the originating assistant turn rather than
            // rendering it as a separate pseudo-user message.
            const lastAssistant = messages.value.slice().reverse().find(m => m.role === 'assistant');
            if (lastAssistant?.toolCalls?.length) {
                const target = lastAssistant.toolCalls.find(t => t.result === undefined);
                if (target) {
                    target.result = event.summary || 'Tool operation completed';
                    break;
                }
            }
            // Fallback to a compact status line if no matching tool call exists.
            messages.value.push({
                role: 'tool',
                content: event.summary || 'Tool operation completed',
                id: Date.now(),
            });
            break;
        }

        case 'error':
            errorMessage.value = event.message;
            processing.value = false;
            break;

        case 'done':
            // Accumulate session usage (shown in the config panel).
            usageStore.add(usageKey.value, typeof event.totalCostUsd === 'number' ? event.totalCostUsd : 0);

            // Mark last assistant message as done streaming
            const lastDone = messages.value[messages.value.length - 1];
            if (lastDone?.isStreaming) {
                lastDone.isStreaming = false;
            }
            processing.value = false;

            // If this was a new session, navigate to the real session URL
            // so the sidebar picks it up on re-render
            if (isNewSession && activeSessionId.value) {
                const newId = activeSessionId.value;
                activeSessionId.value = null; // prevent re-trigger
                navigateTo(
                    `/projects/${encodeURIComponent(absolute_path)}/sessions/${newId}`,
                    { replace: true }
                );
            }
            break;

        case 'cancelled':
            const lastCancelled = messages.value[messages.value.length - 1];
            if (lastCancelled?.isStreaming) {
                lastCancelled.isStreaming = false;
            }
            processing.value = false;
            break;

        case 'init':
            activeSessionId.value = event.sessionId;

            // Refresh the project store so the sidebar picks up the new session
            if (isNewSession) {
                useSelectedProjectStore().set(absolute_path);
            }
            break;

        case 'commands_changed':
            // Slash commands are handled by the composable
            break;
    }

    if (event.type !== 'pong' && event.type !== 'auth_ok') {
        rawOutput.value.push(JSON.stringify(event, null, 2));
    }
});

// ── Actions ─────────────────────────────────────────────────────

function sendPrompt() {
    const hasText = !!inputText.value.trim();
    const atts = attachments.value.map(a => ({ name: a.name, mediaType: a.mediaType, data: a.data }));
    if ((!hasText && atts.length === 0) || processing.value) return;

    const text = inputText.value;
    inputText.value = '';
    processing.value = true;
    errorMessage.value = null;

    // Echo the user's message (with an attachment summary) into the transcript.
    const attachNote = atts.length
        ? `${hasText ? '\n\n' : ''}📎 ${atts.length} attachment${atts.length > 1 ? 's' : ''}: ${atts.map(a => a.name).join(', ')}`
        : '';
    messages.value.push({ role: 'user', content: text + attachNote, id: Date.now() });
    attachments.value = [];

    const model = claudeConfig.value.model;
    const effort = claudeConfig.value.effort;

    if (isNewSession && !activeSessionId.value) {
        // Start a new session
        ws.startSession(text, { projectPath: absolute_path, model, effort, attachments: atts });
    } else if (activeSessionId.value) {
        // Send message to the existing session (model/effort applied per-turn)
        ws.sendMessage(text, { model, effort, attachments: atts });
    } else {
        // Resume then send
        ws.resumeSession(session_id, text, { projectPath: absolute_path, model, effort, attachments: atts });
    }
}

// ── Slash command menu ──────────────────────────────────────────

const slashMenu = reactive({ show: false, filter: '', selectedIndex: 0 });
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const filteredCommands = computed(() => {
    const cmds = ws.slashCommands.value;
    if (!cmds?.length) return [];
    const filter = slashMenu.filter.toLowerCase();
    return cmds.filter((cmd: any) =>
        cmd.name.toLowerCase().includes(filter) ||
        cmd.description.toLowerCase().includes(filter)
    );
});

watch(inputText, (val) => {
    if (val?.startsWith('/')) {
        const afterSlash = val.slice(1).split(' ')[0] ?? '';
        slashMenu.filter = afterSlash;
        slashMenu.show = true;
        slashMenu.selectedIndex = 0;
    } else {
        slashMenu.show = false;
    }
});

function selectCommand(cmd: any) {
    inputText.value = `/${cmd.name} `;
    slashMenu.show = false;
    // Keep focus in the textarea after picking a command (a click otherwise loses it).
    nextTick(() => textareaRef.value?.focus());
}

function onInputKeydown(e: KeyboardEvent) {
    if (slashMenu.show && filteredCommands.value.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            slashMenu.selectedIndex = Math.min(slashMenu.selectedIndex + 1, filteredCommands.value.length - 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            slashMenu.selectedIndex = Math.max(slashMenu.selectedIndex - 1, 0);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            selectCommand(filteredCommands.value[slashMenu.selectedIndex]);
            return;
        }
        if (e.key === 'Escape') {
            slashMenu.show = false;
            return;
        }
    }

    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
    }
}

function newSession() {
    if (processing.value) {
        ws.cancelSession();
    }
    messages.value = [];
    rawOutput.value = [];
    fileChanges.value = [];
    processing.value = false;
    errorMessage.value = null;
    activeSessionId.value = null;

    navigateTo(`/projects/${encodeURIComponent(absolute_path)}/sessions/new`, { replace: true });
}

// ── Auto-scroll ─────────────────────────────────────────────────

const chatContainer = ref<HTMLElement | null>(null);

watch(messages, () => {
    const el = chatContainer.value;
    if (!el) return;
    // Only stick to the bottom if the user is already near it — don't yank them down
    // while they're scrolled up reading earlier output.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nextTick(() => {
        if (chatContainer.value && nearBottom) {
            chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
    });
}, { deep: true });

</script>

<template>
    <UDashboardPanel id="session-chat">
        <template #header>
            <div class="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
                <!-- Left: Session title -->
                <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span class="text-sm sm:text-base font-medium text-slate-200 truncate max-w-[150px] sm:max-w-[300px] lg:max-w-[400px]">
                        {{ isNewSession ? 'New Session' : `Session ${session_id.substring(0, 8)}` }}
                    </span>
                </div>

                <!-- Center -->
                <div class="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base text-slate-300 font-medium">
                    <UIcon name="i-lucide-sparkles" class="w-4 h-4 text-amber-400" />
                    <span class="hidden sm:inline">Claude Code</span>
                </div>

                <!-- Right: Actions -->
                <div class="flex items-center gap-1">
                    <UBadge
                        v-if="connected"
                        size="sm"
                        color="success"
                        variant="soft"
                        class="hidden sm:flex"
                    >
                        <UIcon name="i-lucide-wifi" class="mr-1" />
                        Connected
                    </UBadge>
                    <UBadge
                        v-else
                        size="sm"
                        color="error"
                        variant="soft"
                        class="hidden sm:flex"
                    >
                        <UIcon name="i-lucide-wifi-off" class="mr-1" />
                        Disconnected
                    </UBadge>

                    <UButton
                        icon="i-lucide-plus"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        title="New Chat"
                        aria-label="New chat"
                        @click="newSession"
                    />
                    <UButton
                        v-if="processing"
                        icon="i-lucide-square"
                        color="error"
                        variant="soft"
                        size="sm"
                        title="Stop"
                        aria-label="Stop Claude"
                        @click="ws.cancelSession(); processing = false"
                    />
                    <UButton
                        icon="i-lucide-settings-2"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        title="Configuration"
                        aria-label="Configuration"
                        @click="configOpen = !configOpen; void 0"
                    />
                </div>
            </div>
        </template>

        <template #body>
            <div class="flex flex-1 min-h-0 h-full">
                <!-- Main chat area -->
                <div class="flex-1 flex flex-col min-w-0">
                    <!-- Error banner -->
                    <div
                        v-if="errorMessage"
                        class="mx-3 sm:mx-4 mt-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2"
                    >
                        <UIcon name="i-lucide-alert-circle" class="w-4 h-4 shrink-0" />
                        <span class="flex-1">{{ errorMessage }}</span>
                        <UButton
                            icon="i-lucide-x"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            aria-label="Dismiss error"
                            @click="errorMessage = null; void 0"
                        />
                    </div>

                    <!-- Loading history -->
                    <div
                        v-if="loadingHistory"
                        class="flex items-center justify-center py-20 flex-1"
                    >
                        <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-slate-400" />
                    </div>

                    <!-- Chat messages -->
                    <div
                        v-else
                        ref="chatContainer"
                        class="flex-1 overflow-y-auto pb-4 space-y-0"
                    >
                        <!-- Welcome state for new session -->
                        <div
                            v-if="messages.length === 0 && !processing"
                            class="flex flex-col items-center justify-center text-center text-slate-400 mt-10 sm:mt-20"
                        >
                            <UIcon name="i-lucide-bot" class="text-4xl sm:text-5xl mb-4 text-slate-600" />
                            <h3 class="text-lg font-medium text-slate-300 mb-1">Start a conversation</h3>

                            <div class="space-y-1 mt-3 text-sm">
                                <p class="text-slate-500">
                                    {{ absolute_path }}
                                </p>
                            </div>

                            <p class="text-sm max-w-md px-4 mt-4 text-slate-400">
                                Ask Claude to help with your code — write files, run commands, refactor, debug, and more.
                            </p>
                            <p class="text-xs text-slate-600 mt-2">
                                Type <kbd class="px-1 py-0.5 bg-slate-800 rounded text-[10px] font-mono">/</kbd> for commands
                            </p>
                        </div>

                        <!-- Message list -->
                        <template v-for="msg in messages" :key="msg.id">
                            <!-- User turn: prompt pill on a clean neutral band -->
                            <div v-if="msg.role === 'user'" class="py-3">
                                <div class="max-w-4xl mx-auto px-3 sm:px-4">
                                    <div class="flex items-start gap-2">
                                        <UIcon name="i-lucide-user" class="w-4 h-4 mt-0.5 text-slate-500 flex-shrink-0" />
                                        <div class="flex-1 min-w-0">
                                            <span
                                                v-if="msg.isCommand"
                                                class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 bg-slate-800 font-mono text-xs text-primary-300 border border-slate-700/50"
                                            >
                                                <UIcon name="i-lucide-terminal" class="w-3 h-3 text-slate-500" />
                                                {{ msg.content }}
                                            </span>
                                            <span v-else class="text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap break-words">{{ msg.content }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Assistant turn: full-width stream with colored tool chips -->
                            <div v-else-if="msg.role === 'assistant'" class="py-4">
                                <div class="max-w-4xl mx-auto px-3 sm:px-4 space-y-3">
                                    <!-- Thinking block (collapsible) -->
                                    <div
                                        v-if="msg.thinking"
                                        class="border border-slate-700/50 rounded-lg overflow-hidden"
                                    >
                                        <details class="group">
                                            <summary class="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer bg-slate-900/40 hover:bg-slate-800/40 transition-colors">
                                                <UIcon name="i-lucide-brain" class="w-3.5 h-3.5" />
                                                <span>Thinking</span>
                                                <UIcon name="i-lucide-chevron-down" class="w-3 h-3 ml-auto group-open:rotate-180 transition-transform" />
                                            </summary>
                                            <div class="px-3 py-2 text-xs text-slate-400 italic border-t border-slate-800 whitespace-pre-wrap">
                                                {{ msg.thinking }}
                                            </div>
                                        </details>
                                    </div>

                                    <!-- Content (markdown rendered) -->
                                    <ClaudeMarkdown
                                        v-if="msg.content"
                                        :content="msg.content"
                                    />

                                    <!-- Streaming indicator -->
                                    <div
                                        v-if="msg.isStreaming && !msg.content"
                                        class="flex items-center gap-2 text-slate-400 text-sm"
                                    >
                                        <UIcon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                                        <span>Claude is thinking...</span>
                                    </div>

                                    <!-- Tool calls -->
                                    <div v-if="msg.toolCalls?.length" class="mt-2 space-y-0">
                                        <ClaudeFileEdit
                                            v-for="edit in msg.toolCalls"
                                            :key="edit.tool_use_id"
                                            :tool-name="edit.name"
                                            :input="edit.input"
                                            :result="edit.result"
                                            :is-error="edit.isError"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Tool status line (legacy fallback) -->
                            <div v-else class="py-3">
                                <div class="max-w-4xl mx-auto px-3 sm:px-4">
                                    <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border bg-slate-800/60 border-slate-700/50 text-slate-400">
                                        <UIcon name="i-lucide-wrench" class="w-3.5 h-3.5" />
                                        {{ msg.content }}
                                    </span>
                                </div>
                            </div>
                        </template>

                        <!-- Processing indicator (no messages yet) -->
                        <div v-if="processing && messages.length === 0" class="py-5">
                            <div class="max-w-4xl mx-auto px-3 sm:px-4 flex items-center gap-2 text-slate-400 text-sm">
                                <UIcon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                                <span>Claude is thinking...</span>
                            </div>
                        </div>

                        <!-- Typing indicator (processing with existing messages) -->
                        <div v-if="processing && messages.length > 0" class="py-5">
                            <div class="max-w-4xl mx-auto px-3 sm:px-4 flex items-center gap-2 text-slate-400 text-sm">
                                <div class="flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
                                    <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
                                    <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
                                </div>
                                <span>Claude is working...</span>
                            </div>
                        </div>
                    </div>

                    <!-- Chat input -->
                    <!-- Slash command menu -->
                    <Teleport to="body">
                        <div
                            v-if="slashMenu.show && filteredCommands.length > 0"
                            class="fixed z-100 px-4"
                            :style="{ left: '50%', bottom: '120px', transform: 'translateX(-50%)' }"
                        >
                            <div
                                id="slash-command-menu"
                                role="listbox"
                                aria-label="Slash commands"
                                class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
                            >
                                <button
                                    v-for="(cmd, i) in filteredCommands"
                                    :key="cmd.name"
                                    role="option"
                                    :aria-selected="i === slashMenu.selectedIndex"
                                    :class="[
                                        'w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors border-b border-slate-700/50 last:border-b-0',
                                        i === slashMenu.selectedIndex ? 'bg-primary-500/20 text-primary-300' : 'text-slate-300 hover:bg-slate-700/60'
                                    ]"
                                    @click="selectCommand(cmd)"
                                    @mouseenter="slashMenu.selectedIndex = i"
                                >
                                    <span class="font-mono text-primary-400">/{{ cmd.name }}</span>
                                    <span class="text-xs text-slate-500 truncate flex-1">{{ cmd.description }}</span>
                                    <span v-if="cmd.argumentHint" class="text-[10px] text-slate-600 font-mono">{{ cmd.argumentHint }}</span>
                                </button>
                            </div>
                        </div>
                    </Teleport>

                    <div class="border-t border-slate-800 bg-slate-900/80 p-3 sm:p-4">
                        <div class="max-w-4xl mx-auto">
                            <!-- Hidden file pickers -->
                            <input ref="fileInput" type="file" multiple class="hidden" @change="onFilesSelected" >
                            <input ref="imageInput" type="file" accept="image/*" multiple class="hidden" @change="onFilesSelected" >

                            <!-- Pending attachments -->
                            <div v-if="attachments.length" class="flex flex-wrap gap-2 mb-2">
                                <div
                                    v-for="(att, i) in attachments"
                                    :key="i"
                                    class="flex items-center gap-2 bg-slate-800/80 border border-slate-700/50 rounded-lg pl-2 pr-1 py-1 text-xs text-slate-300 max-w-[240px]"
                                >
                                    <UIcon :name="att.isImage ? 'i-lucide-image' : 'i-lucide-file'" class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    <span class="truncate">{{ att.name }}</span>
                                    <span class="text-slate-600 flex-shrink-0">{{ formatBytes(att.size) }}</span>
                                    <UButton
                                        icon="i-lucide-x"
                                        color="neutral"
                                        variant="ghost"
                                        size="xs"
                                        :aria-label="`Remove ${att.name}`"
                                        @click="removeAttachment(i)"
                                    />
                                </div>
                            </div>

                            <div class="flex items-end gap-2 bg-slate-800/60 border border-slate-700/50 rounded-2xl px-3 py-2 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/30 transition-all">
                                <!-- Left: attachment buttons -->
                                <div class="flex items-center gap-1 pb-1.5">
                                    <UButton
                                        icon="i-lucide-paperclip"
                                        color="neutral"
                                        variant="ghost"
                                        size="sm"
                                        title="Attach file"
                                        aria-label="Attach file"
                                        :disabled="!connected || processing"
                                        @click="fileInput?.click()"
                                    />
                                    <UButton
                                        icon="i-lucide-image"
                                        color="neutral"
                                        variant="ghost"
                                        size="sm"
                                        title="Attach image"
                                        aria-label="Attach image"
                                        :disabled="!connected || processing"
                                        @click="imageInput?.click()"
                                    />
                                </div>

                                <!-- Textarea -->
                                <textarea
                                    ref="textareaRef"
                                    v-model="inputText"
                                    :disabled="!connected || processing"
                                    placeholder="Ask Claude anything..."
                                    rows="1"
                                    role="combobox"
                                    aria-label="Message Claude"
                                    aria-controls="slash-command-menu"
                                    :aria-expanded="slashMenu.show"
                                    class="flex-1 bg-transparent px-2 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none outline-none min-h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    @keydown="onInputKeydown"
                                />

                                <!-- Right: submit / stop -->
                                <div class="flex items-center gap-1 pb-1.5">
                                    <UButton
                                        v-if="processing"
                                        icon="i-lucide-square"
                                        color="error"
                                        variant="soft"
                                        size="md"
                                        title="Stop"
                                        aria-label="Stop Claude"
                                        @click="ws.cancelSession(); processing = false"
                                    />
                                    <UButton
                                        v-else
                                        icon="i-lucide-arrow-up"
                                        :disabled="!connected || (!inputText.trim() && attachments.length === 0)"
                                        color="primary"
                                        size="md"
                                        aria-label="Send message"
                                        @click="sendPrompt"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Review panel -->
                <ClaudeReviewPanel v-model="reviewOpen" :changes="fileChanges" />
            </div>
        </template>
    </UDashboardPanel>

    <!-- Config panel -->
    <ClaudeConfigPanel
        v-model="configOpen"
        :config="claudeConfig"
        :usage="sessionUsage"
        @update:config="Object.assign(claudeConfig, $event)"
    />
</template>

<style scoped>
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.animate-spin {
    animation: spin 1s linear infinite;
}

@keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
}
.animate-bounce {
    animation: bounce 1.4s ease-in-out infinite;
}
</style>
