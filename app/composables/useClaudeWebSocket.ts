import { useRuntimeAppConfigs } from './useRuntimeAppConfigs';
import { createEventHook } from '@vueuse/core';

export interface ClaudeWSEvent {
    type: string;
    [key: string]: any;
}

export interface SlashCommand {
    name: string;
    description: string;
    argumentHint?: string;
    aliases?: string[];
}

export function useClaudeWebSocket() {
    const ws = ref<WebSocket | null>(null);
    const connected = ref(false);
    const authenticating = ref(false);
    const authenticated = ref(false);
    const activeSessionId = ref<string | null>(null);
    const error = ref<string | null>(null);
    const slashCommands = ref<SlashCommand[]>([]);

    const onEvent = createEventHook<ClaudeWSEvent>();

    const wsUrl = '/ws/claude';

    async function connect(): Promise<void> {
        if (ws.value?.readyState === WebSocket.OPEN) return;

        return new Promise<void>((resolve, reject) => {
            try {
                const socket = new WebSocket(wsUrl);

                socket.onopen = () => {
                    connected.value = true;
                    authenticating.value = true;
                    error.value = null;

                    // Send auth immediately
                    const token = useCookie('mindcode_session_token').value;
                    if (!token) {
                        reject(new Error('No session token found'));
                        socket.close();
                        return;
                    }
                    socket.send(JSON.stringify({ type: 'auth', token }));
                };

                socket.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);

                        if (msg.type === 'auth_ok') {
                            authenticated.value = true;
                            authenticating.value = false;
                            resolve();
                        } else if (msg.type === 'init') {
                            activeSessionId.value = msg.sessionId;
                        } else if (msg.type === 'error') {
                            error.value = msg.message;
                        } else if (msg.type === 'done') {
                            activeSessionId.value = null;
                        } else if (msg.type === 'cancelled') {
                            activeSessionId.value = null;
                        } else if (msg.type === 'commands_changed' && msg.commands) {
                            slashCommands.value = msg.commands;
                        }

                        onEvent.trigger(msg);
                    } catch {
                        // ignore parse errors
                    }
                };

                socket.onclose = (event) => {
                    connected.value = false;
                    authenticated.value = false;
                    activeSessionId.value = null;
                    if (event.code !== 1000 && event.code !== 1001) {
                        const errMsg = event.reason || `WebSocket closed (code: ${event.code})`;
                        error.value = errMsg;
                        if (!authenticated.value) {
                            reject(new Error(errMsg));
                        }
                    }
                };

                socket.onerror = () => {
                    // onclose will fire after this with details
                    if (!authenticated.value) {
                        reject(new Error('WebSocket connection failed'));
                    }
                };

                ws.value = socket;
            } catch (err: any) {
                reject(err);
            }
        });
    }

    async function fetchSlashCommands(): Promise<SlashCommand[]> {
        try {
            const result = await useAPI((api: any) => api.getClaudeCommands());
            if (result.success) {
                slashCommands.value = result.data.commands;
                return result.data.commands;
            }
        } catch (err) {
            console.error('Failed to fetch slash commands:', err);
        }
        return slashCommands.value;
    }

    function send(msg: Record<string, any>) {
        if (ws.value?.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify(msg));
        } else {
            error.value = 'WebSocket not connected';
        }
    }

    function startSession(prompt: string, options?: { projectPath?: string; model?: string; effort?: string }) {
        send({ type: 'start', prompt, ...options });
    }

    function resumeSession(sessionId: string, prompt: string, options?: { projectPath?: string; model?: string; effort?: string }) {
        send({ type: 'start', prompt, resume: sessionId, ...options });
    }

    function sendMessage(content: string) {
        send({ type: 'message', content });
    }

    function cancelSession() {
        send({ type: 'cancel' });
    }

    function disconnect() {
        ws.value?.close();
        ws.value = null;
        connected.value = false;
        authenticated.value = false;
        activeSessionId.value = null;
    }

    onUnmounted(() => {
        disconnect();
    });

    return {
        connected: readonly(connected),
        authenticating: readonly(authenticating),
        authenticated: readonly(authenticated),
        activeSessionId: readonly(activeSessionId),
        error: readonly(error),
        slashCommands: readonly(slashCommands),
        connect,
        fetchSlashCommands,
        send,
        startSession,
        resumeSession,
        sendMessage,
        cancelSession,
        disconnect,
        onEvent: onEvent.on,
    };
}
