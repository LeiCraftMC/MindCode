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

export interface ChatAttachment {
    name: string;
    mediaType: string;
    /** base64-encoded file bytes */
    data: string;
}

export interface SendOptions {
    projectPath?: string;
    model?: string;
    effort?: string;
    attachments?: ChatAttachment[];
}

// Shown immediately so "/" autocomplete works before a session is live; replaced by the
// real, session-specific list as soon as the WS sends a `commands_changed` event.
const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
    { name: 'clear', description: 'Clear the conversation and start fresh' },
    { name: 'compact', description: 'Summarize the conversation to free up context' },
    { name: 'cost', description: 'Show token usage and cost for this session' },
    { name: 'review', description: 'Review the pending changes' },
    { name: 'help', description: 'List available commands' },
];

// How long to wait for the auth handshake before giving up on a connection.
const AUTH_TIMEOUT_MS = 10_000;

export function useClaudeWebSocket() {
    const ws = ref<WebSocket | null>(null);
    const connected = ref(false);
    const authenticating = ref(false);
    const authenticated = ref(false);
    const activeSessionId = ref<string | null>(null);
    const error = ref<string | null>(null);
    const slashCommands = ref<SlashCommand[]>([...DEFAULT_SLASH_COMMANDS]);

    const onEvent = createEventHook<ClaudeWSEvent>();

    const wsUrl = '/ws/claude';

    async function connect(): Promise<void> {
        if (ws.value?.readyState === WebSocket.OPEN) return;

        return new Promise<void>((resolve, reject) => {
            // Guarantee the promise settles exactly once. Previously a clean early close
            // (code 1000/1001) before `auth_ok` resolved neither path, hanging connect()
            // forever and leaving the UI stuck on "Disconnected" with no error.
            let settled = false;
            const settle = (err?: Error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve();
            };

            let socket: WebSocket;

            const timeout = setTimeout(() => {
                error.value = 'Timed out connecting to Claude Code server';
                settle(new Error(error.value));
                try { socket?.close(); } catch { /* noop */ }
            }, AUTH_TIMEOUT_MS);

            try {
                socket = new WebSocket(wsUrl);
            } catch (err: any) {
                settle(err instanceof Error ? err : new Error('Failed to open WebSocket'));
                return;
            }

            socket.onopen = () => {
                connected.value = true;
                authenticating.value = true;
                error.value = null;

                // Send auth immediately
                const token = useCookie('mindcode_session_token').value;
                if (!token) {
                    error.value = 'No session token found';
                    settle(new Error(error.value));
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
                        settle();
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
                authenticating.value = false;
                authenticated.value = false;
                activeSessionId.value = null;
                if (event.code !== 1000 && event.code !== 1001) {
                    error.value = event.reason || `WebSocket closed (code: ${event.code})`;
                }
                // Reject if the socket closed before the auth handshake completed,
                // regardless of close code. After auth this is a no-op (already settled).
                settle(new Error(error.value || `WebSocket closed (code: ${event.code})`));
            };

            socket.onerror = () => {
                // onclose fires after this with details; settle defensively.
                settle(new Error('WebSocket connection failed'));
            };

            ws.value = socket;
        });
    }

    // The real, session-specific command list arrives via the WS `commands_changed` event
    // once a session starts; until then the defaults are shown.
    async function fetchSlashCommands(): Promise<SlashCommand[]> {
        return slashCommands.value;
    }

    /** Sends a message over the socket. Returns false (and sets `error`) if not connected. */
    function send(msg: Record<string, any>): boolean {
        if (ws.value?.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify(msg));
            return true;
        }
        error.value = 'WebSocket not connected';
        return false;
    }

    function startSession(prompt: string, options?: SendOptions): boolean {
        return send({ type: 'start', prompt, ...options });
    }

    function resumeSession(sessionId: string, prompt: string, options?: SendOptions): boolean {
        return send({ type: 'start', prompt, resume: sessionId, ...options });
    }

    function sendMessage(content: string, options?: Omit<SendOptions, 'projectPath'>): boolean {
        return send({ type: 'message', content, ...options });
    }

    function cancelSession(): boolean {
        return send({ type: 'cancel' });
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
