<script setup lang="ts">
import { useUserInfoStore } from '~/composables/stores/useUserStore';
import { useClaudeSessionStore } from '~/composables/stores/useClaudeSessionStore';

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

// Chat state
const messages = ref<Array<{ role: string; content: string; id: number }>>([]);
const rawOutput = ref<string[]>([]);
const showTerminal = ref(false);
const inputText = ref('');
const processing = ref(false);
const connected = ref(false);
const errorMessage = ref<string | null>(null);

// Connect WebSocket on mount
onMounted(async () => {
    try {
        await ws.connect();
        connected.value = true;
        await sessionStore.fetchSessions();
    } catch (err: any) {
        errorMessage.value = err.message || 'Failed to connect to Claude Code server';
        connected.value = false;
    }
});

// Listen for WebSocket events
ws.onEvent((event) => {
    switch (event.type) {
        case 'delta':
            // Append to last assistant message
            const last = messages.value[messages.value.length - 1];
            if (last?.role === 'assistant') {
                last.content += event.content;
            } else {
                messages.value.push({ role: 'assistant', content: event.content, id: Date.now() });
            }
            break;
        case 'message_done':
            processing.value = false;
            break;
        case 'message_start':
            // New message starting
            messages.value.push({ role: 'assistant', content: '', id: Date.now() });
            break;
        case 'tool_use':
            messages.value.push({ role: 'tool', content: `Using tool: ${event.name}`, id: Date.now() });
            break;
        case 'tool_result':
            messages.value.push({ role: 'tool', content: `Tool result: ${event.name}`, id: Date.now() });
            break;
        case 'error':
            errorMessage.value = event.message;
            processing.value = false;
            break;
        case 'done':
            processing.value = false;
            break;
        case 'cancelled':
            processing.value = false;
            break;
        case 'system_init':
            // Session initialized
            break;
    }

    // Always append to raw output (except keepalive/auth)
    if (event.type !== 'pong' && event.type !== 'auth_ok') {
        rawOutput.value.push(JSON.stringify(event, null, 2));
    }
});

function sendPrompt() {
    if (!inputText.value.trim() || processing.value) return;

    const text = inputText.value;
    inputText.value = '';
    processing.value = true;
    errorMessage.value = null;

    messages.value.push({ role: 'user', content: text, id: Date.now() });

    if (messages.value.length === 1) {
        ws.startSession(text);
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
    processing.value = false;
    errorMessage.value = null;
}

function loadSession(id: string) {
    if (processing.value) {
        ws.cancelSession();
    }
    sessionStore.fetchSession(id);
    // TODO: load messages into chat view
}

function deleteSession(id: string) {
    sessionStore.deleteSession(id);
}

const chatContainer = ref<HTMLElement | null>(null);

// Auto-scroll to bottom when new messages arrive
watch(messages, () => {
    nextTick(() => {
        if (chatContainer.value) {
            chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
    });
}, { deep: true });
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <UDashboardNavbar title="Claude Code" icon="i-lucide-bot">
                <template #right>
                    <div class="flex items-center gap-2">
                        <UBadge
                            v-if="connected"
                            size="sm"
                            color="success"
                            variant="soft"
                        >
                            <UIcon name="i-lucide-wifi" class="mr-1" />
                            Connected
                        </UBadge>
                        <UBadge
                            v-else
                            size="sm"
                            color="error"
                            variant="soft"
                        >
                            <UIcon name="i-lucide-wifi-off" class="mr-1" />
                            Disconnected
                        </UBadge>

                        <UButton
                            :icon="showTerminal ? 'i-lucide-message-square' : 'i-lucide-terminal'"
                            :label="showTerminal ? 'Chat' : 'Terminal'"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            @click="showTerminal = !showTerminal"
                        />
                        <UButton
                            icon="i-lucide-plus"
                            label="New"
                            color="primary"
                            variant="solid"
                            size="sm"
                            @click="newSession"
                        />
                    </div>
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div class="flex h-full">
                <!-- Session Sidebar -->
                <ClaudeSessionSidebar
                    :sessions="sessionStore.sessions.value"
                    :active-id="undefined"
                    @select="loadSession"
                    @delete="deleteSession"
                    @new="newSession"
                />

                <!-- Main Chat Area -->
                <div class="flex-1 flex flex-col min-w-0">
                    <!-- Error banner -->
                    <div
                        v-if="errorMessage"
                        class="mx-4 mt-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2"
                    >
                        <UIcon name="i-lucide-alert-circle" class="w-4 h-4 flex-shrink-0" />
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
                        class="flex-1 overflow-y-auto p-4 space-y-4"
                    >
                        <ClaudeChatMessage
                            v-for="msg in messages"
                            :key="msg.id"
                            :role="msg.role"
                            :content="msg.content"
                            :id="msg.id"
                        />

                        <!-- Processing indicator -->
                        <div v-if="processing" class="flex gap-3">
                            <div class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                <UIcon name="i-lucide-bot" class="text-white w-4 h-4" />
                            </div>
                            <div class="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3">
                                <div class="flex items-center gap-2 text-slate-400 text-sm">
                                    <UIcon name="i-lucide-loader" class="w-4 h-4 animate-spin" />
                                    <span>Claude is thinking...</span>
                                </div>
                            </div>
                        </div>

                        <!-- Empty state -->
                        <div
                            v-if="!messages.length && !processing"
                            class="flex flex-col items-center justify-center text-center text-slate-500 mt-20"
                        >
                            <UIcon name="i-lucide-bot" class="text-5xl mb-4 text-slate-600" />
                            <h3 class="text-lg font-medium text-slate-400 mb-1">Claude Code</h3>
                            <p class="text-sm max-w-md">
                                Ask Claude to help with your code — write files, run commands, refactor, debug, and more.
                            </p>
                        </div>
                    </div>

                    <!-- Terminal View -->
                    <ClaudeTerminalView v-else :lines="rawOutput" />

                    <!-- Input -->
                    <ClaudeChatInput
                        v-model="inputText"
                        :disabled="!connected || processing"
                        placeholder="Ask Claude to do something..."
                        @submit="sendPrompt"
                    />
                </div>
            </div>
        </template>
    </UDashboardPanel>
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
