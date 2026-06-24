<script setup lang="ts">
import { useUserInfoStore } from '~/composables/stores/useUserStore';
import { useClaudeSessionStore } from '~/composables/stores/useClaudeSessionStore';
import type { ClaudeConfig } from '~/components/claude/ClaudeConfigPanel.vue';

definePageMeta({
    layout: 'dashboard',
});

useSeoMeta({
    title: 'Claude Code | MindCode',
    description: 'Interact with Claude Code from your browser'
});

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();
if (!userInfoStore.isValid(user)) {
    throw new Error('User not authenticated but trying to access Claude Code');
}

const ws = useClaudeWebSocket();
const sessionStore = useClaudeSessionStore();

// ── Layout state ──────────────────────────────────────────────
const sidebarOpen = ref(false);
const configOpen = ref(false);
const showTerminal = ref(false);
const reviewOpen = ref(false);

// ── Chat state ─────────────────────────────────────────────────
const messages = ref<Array<{
    role: string;
    content: string;
    id: number;
    toolCalls?: Array<{ name: string; input: Record<string, any>; tool_use_id: string }>;
}>>([]);
const rawOutput = ref<string[]>([]);
const inputText = ref('');
const processing = ref(false);
const connected = ref(false);
const errorMessage = ref<string | null>(null);
const activeSessionId = ref<string | null>(null);
const activeProjectPath = ref<string | null>(null);

// ── Config state ──────────────────────────────────────────────
const claudeConfig = ref<ClaudeConfig>({
    model: 'sonnet',
    effort: 'max',
    thinking: true,
    autoFlag: true,
    editAuto: true,
});

// ── Review panel state (file changes) ───────────────────────────
const fileChanges = ref<Array<{
    file: string;
    toolName: string;
    added?: number;
    removed?: number;
}>>([]);

// ── Connect WebSocket on mount ────────────────────────────────
onMounted(async () => {
    sessionStore.loadProjectsFromStorage();

    try {
        await ws.connect();
        connected.value = true;
        await Promise.all([
            sessionStore.fetchSessions(),
            ws.fetchSlashCommands(),
        ]);
    } catch (err: any) {
        errorMessage.value = err.message || 'Failed to connect to Claude Code server';
        connected.value = false;
    }
});

// ── Derived project info for welcome screen ─────────────────────
const currentProject = computed(() => {
    if (!activeProjectPath.value) return null;
    return sessionStore.projects.value.find(p => p.path === activeProjectPath.value) || null;
});

const activeSession = computed(() => {
    if (!activeSessionId.value) return null;
    for (const project of sessionStore.projects.value) {
        const s = project.sessions.find(x => x.sessionId === activeSessionId.value);
        if (s) return s;
    }
    return null;
});

function formatLastModified(ts?: number): string {
    if (!ts) return 'just now';
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'vor 0 Sekunden';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Minuten`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Stunden`;
    if (diff < 604800000) return `vor ${Math.floor(diff / 86400000)} Tagen`;
    return d.toLocaleDateString('de-DE');
}

// ── WebSocket event handler ───────────────────────────────────
ws.onEvent((event) => {
    switch (event.type) {
        case 'delta':
            const last = messages.value[messages.value.length - 1];
            if (last?.role === 'assistant') {
                last.content += event.content;
            } else {
                messages.value.push({ role: 'assistant', content: event.content, id: Date.now() });
            }
            break;
        case 'tool_use':
            // Track tool calls for file edits
            const lastMsg = messages.value[messages.value.length - 1];
            if (lastMsg?.role === 'assistant') {
                if (!lastMsg.toolCalls) lastMsg.toolCalls = [];
                lastMsg.toolCalls.push({
                    name: event.name,
                    input: event.input,
                    tool_use_id: event.tool_use_id,
                });
            }

            // Add to review panel for Edit/Write
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
        case 'tool_use_summary':
            messages.value.push({ role: 'tool', content: event.summary || 'Tool operation completed', id: Date.now() });
            break;
        case 'error':
            errorMessage.value = event.message;
            processing.value = false;
            break;
        case 'done':
            processing.value = false;
            sessionStore.fetchSessions();
            break;
        case 'cancelled':
            processing.value = false;
            break;
        case 'init':
            activeSessionId.value = event.sessionId;
            break;
    }

    if (event.type !== 'pong' && event.type !== 'auth_ok') {
        rawOutput.value.push(JSON.stringify(event, null, 2));
    }
});

// ── Actions ───────────────────────────────────────────────────

function sendPrompt() {
    if (!inputText.value.trim() || processing.value) return;

    const text = inputText.value;
    inputText.value = '';
    processing.value = true;
    errorMessage.value = null;

    messages.value.push({ role: 'user', content: text, id: Date.now() });

    if (messages.value.length === 1) {
        ws.startSession(text, {
            projectPath: activeProjectPath.value || undefined,
            model: claudeConfig.value.model,
            effort: claudeConfig.value.effort,
        });
    } else {
        ws.sendMessage(text);
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
}

function newSessionInProject(projectPath: string) {
    activeProjectPath.value = projectPath;
    newSession();
}

function loadSession(id: string) {
    if (processing.value) {
        ws.cancelSession();
    }
    activeSessionId.value = id;
    sessionStore.fetchSession(id);
    const msgs = sessionStore.currentMessages.value;
    if (msgs.length > 0) {
        messages.value = msgs.map((m, i) => ({
            role: m.type === 'user' ? 'user' : m.type === 'system' ? 'tool' : 'assistant',
            content: typeof m.message === 'string' ? m.message : JSON.stringify(m.message),
            id: i,
        }));
    }
}

function deleteSession(id: string) {
    sessionStore.deleteSession(id);
}

function selectProject(path: string) {
    activeProjectPath.value = path;
}

function onAddProject(path: string) {
    sessionStore.addProject(path);
    activeProjectPath.value = path;
    sessionStore.fetchSessions();
}

// ── Auto-scroll ────────────────────────────────────────────────
const chatContainer = ref<HTMLElement | null>(null);

watch(messages, () => {
    nextTick(() => {
        if (chatContainer.value) {
            chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
    });
}, { deep: true });
</script>

<template>
    <div class="flex flex-col h-full">
        <!-- Header -->
        <ClaudeHeader
            :title="activeSessionId ? `Session ${activeSessionId.substring(0, 8)}` : 'Untitled'"
            :session-id="activeSessionId"
            :connected="connected"
            :sidebar-open="sidebarOpen"
            @toggle-sidebar="sidebarOpen = !sidebarOpen"
            @new-chat="newSession"
            @toggle-config="configOpen = !configOpen"
        />

        <!-- Main content area -->
        <div class="flex flex-1 min-h-0">
            <!-- Project sidebar -->
            <ClaudeProjectSidebar
                :projects="sessionStore.projects.value"
                :active-session-id="activeSessionId"
                :active-project-path="activeProjectPath"
                :open="sidebarOpen"
                @select-session="loadSession"
                @delete-session="deleteSession"
                @new-session="newSessionInProject"
                @select-project="selectProject"
                @add-project="onAddProject"
                @close="sidebarOpen = false"
            />

            <!-- Chat area -->
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
                        @click="errorMessage = null"
                    />
                </div>

                <!-- Chat Messages -->
                <div
                    v-if="!showTerminal"
                    ref="chatContainer"
                    class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4"
                >
                    <ClaudeChatMessage
                        v-for="msg in messages"
                        :key="msg.id"
                        :role="msg.role"
                        :content="msg.content"
                        :id="msg.id"
                        :tool-calls="msg.toolCalls"
                    />

                    <!-- Processing indicator -->
                    <div v-if="processing" class="flex gap-3">
                        <div class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
                            <UIcon name="i-lucide-bot" class="text-white w-4 h-4" />
                        </div>
                        <div class="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3">
                            <div class="flex items-center gap-2 text-slate-400 text-sm">
                                <UIcon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                                <span>Claude is thinking...</span>
                            </div>
                        </div>
                    </div>

                    <!-- OpenCode-style welcome state -->
                    <div
                        v-if="!messages.length && !processing"
                        class="flex flex-col items-center justify-center text-center text-slate-400 mt-10 sm:mt-20"
                    >
                        <UIcon name="i-lucide-bot" class="text-4xl sm:text-5xl mb-4 text-slate-600" />
                        <h3 class="text-lg font-medium text-slate-300 mb-1">Baue, was du willst</h3>

                        <div v-if="currentProject || activeSession" class="space-y-1 mt-3 text-sm">
                            <p class="text-slate-500">
                                {{ activeProjectPath || activeSession?.cwd }}
                            </p>
                            <p v-if="activeSession?.gitBranch" class="flex items-center justify-center gap-1 text-slate-600">
                                <UIcon name="i-lucide-git-branch" class="w-3 h-3" />
                                {{ activeSession.gitBranch }}
                            </p>
                            <p class="text-slate-600">
                                Zuletzt geändert {{ formatLastModified(activeSession?.lastModified) }}
                            </p>
                        </div>

                        <p class="text-sm max-w-md px-4 mt-4">
                            Ask Claude to help with your code — write files, run commands, refactor, debug, and more.
                        </p>
                        <p class="text-xs text-slate-600 mt-2">
                            Type <kbd class="px-1 py-0.5 bg-slate-800 rounded text-[10px] font-mono">/</kbd> for commands
                        </p>
                    </div>
                </div>

                <!-- Terminal View -->
                <ClaudeTerminalView v-else :lines="rawOutput" />

                <!-- Input -->
                <ClaudeChatInput
                    v-model="inputText"
                    :disabled="!connected || processing"
                    :slash-commands="ws.slashCommands.value"
                    placeholder="Fragen Sie alles..."
                    @submit="sendPrompt"
                />
            </div>

            <!-- Right review panel -->
            <ClaudeReviewPanel v-model="reviewOpen" :changes="fileChanges" />
        </div>

        <!-- Config panel (centered modal menu) -->
        <ClaudeConfigPanel
            v-model="configOpen"
            :config="claudeConfig"
            @update:config="Object.assign(claudeConfig, $event)"
        />
    </div>
</template>

<style scoped>
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.animate-spin {
    animation: spin 1s linear infinite;
}
</style>
