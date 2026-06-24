import { Logger } from '../../utils/logger';
import { AuthHandler } from '../api/utils/authHandler';
import type { ParsedConfig } from '../../utils/config';
import type { Message } from 'crossws';
import type { Query, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

export interface ClientToServerMessage {
    type: 'auth' | 'start' | 'message' | 'cancel';
    token?: string;
    prompt?: string;
    projectPath?: string;
    model?: string;
    effort?: string;
    content?: string;
}



export interface SessionState {
    peer: any;
    userId: number;
    sessionId: string | null;
    queryIterator: AsyncIterator<any> | null;
    queryHandle: Query | null;
    active: boolean;
}

export class ClaudeSessionRunner {
    private static sessions = new Map<any, SessionState>();
    private static config: ParsedConfig | null = null;

    static configure(config: ParsedConfig) {
        this.config = config;
    }

    static async stop() {
        for (const [peer, session] of this.sessions) {
            session.active = false;
            try { session.queryHandle?.close(); } catch { /* noop */ }
        }
        this.sessions.clear();
        Logger.log('Claude session runner stopped.');
    }

    static async handleOpen(peer: any) {
        this.sessions.set(peer, {
            peer,
            userId: 0,
            sessionId: null,
            queryIterator: null,
            queryHandle: null,
            active: true,
        });
    }

    static async handleClose(peer: any) {
        const session = this.sessions.get(peer);
        if (!session) return;
        session.active = false;
        try { session.queryHandle?.close(); } catch { /* noop */ }
        this.sessions.delete(peer);
    }

    static async handleMessage(peer: any, message: Message) {
        const session = this.sessions.get(peer);
        if (!session) return;

        let msg: ClientToServerMessage;
        try {
            const text = typeof message === 'string' ? message : message.toString();
            msg = JSON.parse(text);
        } catch {
            peer.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
            return;
        }

        switch (msg.type) {
            case 'auth':
                await this.handleAuth(peer, session, msg);
                break;
            case 'start':
                await this.handleStart(peer, session, msg);
                break;
            case 'message':
                await this.handleUserMessage(peer, session, msg);
                break;
            case 'cancel':
                await this.handleCancel(peer, session);
                break;
            default:
                peer.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${(msg as any).type}` }));
        }
    }

    /* ── Auth ────────────────────────────────────────────────── */

    private static async handleAuth(peer: any, session: SessionState, msg: ClientToServerMessage) {
        const authContext = await AuthHandler.getAuthContext(msg.token || '');
        if (!authContext || !(await AuthHandler.isValidAuthContext(authContext))) {
            peer.close(4001, 'Invalid or expired token');
            return;
        }
        session.userId = authContext.user_id;
        peer.send(JSON.stringify({ type: 'auth_ok' }));
    }

    /* ── Start session ──────────────────────────────────────── */

    private static async handleStart(peer: any, session: SessionState, msg: ClientToServerMessage) {
        if (!session.userId) {
            peer.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
        }

        if (session.queryIterator) {
            peer.send(JSON.stringify({ type: 'error', message: 'Session already started' }));
            return;
        }

        const projectPath = msg.projectPath || process.cwd();
        const model = msg.model || this.config?.MINDCODE_CLAUDE_DEFAULT_MODEL || undefined;
        const effort = msg.effort || this.config?.MINDCODE_CLAUDE_DEFAULT_EFFORT || undefined;
        const prompt = msg.prompt || '';

        // The SDK auto-creates and persists the session as a JSONL file
        // in ~/.claude/projects/<dir>/<sessionId>.jsonl
        const sessionUuid = crypto.randomUUID();
        session.sessionId = sessionUuid;

        peer.send(JSON.stringify({ type: 'init', sessionId: sessionUuid }));

        try {
            const sdk = await import('@anthropic-ai/claude-agent-sdk');

            const options: any = {
                allowedTools: this.config?.MINDCODE_CLAUDE_ALLOWED_TOOLS?.split(',').map(s => s.trim()) || undefined,
                maxTurns: this.config?.MINDCODE_CLAUDE_MAX_TURNS ? parseInt(this.config.MINDCODE_CLAUDE_MAX_TURNS) : undefined,
                maxBudgetUsd: this.config?.MINDCODE_CLAUDE_MAX_BUDGET_USD ? parseFloat(this.config.MINDCODE_CLAUDE_MAX_BUDGET_USD) : undefined,
                model,
                effortLevel: effort,
                sessionId: sessionUuid,
            };

            // Remove undefined values
            for (const key of Object.keys(options)) {
                if (options[key] === undefined) delete options[key];
            }

            const queryHandle = sdk.query({
                prompt,
                options,
            });

            session.queryHandle = queryHandle;
            session.queryIterator = queryHandle[Symbol.asyncIterator]();

            this.runMessageLoop(peer, session);

        } catch (err: any) {
            Logger.error('Failed to start Claude SDK query:', err);
            peer.send(JSON.stringify({ type: 'error', message: `Failed to start claude: ${err.message}` }));
        }
    }

    /* ── Message loop ────────────────────────────────────────── */

    private static async runMessageLoop(peer: any, session: SessionState) {
        if (!session.queryIterator) return;

        try {
            while (session.active) {
                const { value, done } = await session.queryIterator!.next();
                if (done || !session.active) break;

                if (!value) continue;

                // Forward SDK messages to client
                this.forwardToClient(peer, value);

                // Final result handling
                if (value.type === 'result') {
                    session.queryIterator = null;
                    break;
                }
            }
        } catch (err: any) {
            Logger.error('Error in Claude SDK message loop:', err);
            if (session.active) {
                peer.send(JSON.stringify({ type: 'error', message: err.message || 'SDK stream error' }));
            }
        }
    }

    /* ── User message ────────────────────────────────────────── */

    private static async handleUserMessage(peer: any, session: SessionState, msg: ClientToServerMessage) {
        if (!session.queryHandle || !session.queryIterator) {
            peer.send(JSON.stringify({ type: 'error', message: 'No active session' }));
            return;
        }

        try {
            // Agent SDK supports streaming input via streamInput on the query handle
            if (typeof session.queryHandle.streamInput === 'function') {
                async function* inputStream(): AsyncGenerator<SDKUserMessage> {
                    yield {
                        type: 'user',
                        message: { role: 'user', content: msg.content || '' },
                        parent_tool_use_id: null,
                    };
                }
                await session.queryHandle.streamInput(inputStream());
            } else {
                // Fallback: close current query and start a new one with resume
                const currentSessionId = session.sessionId;
                session.queryHandle.close();
                session.queryIterator = null;
                session.queryHandle = null;

                if (!currentSessionId) {
                    peer.send(JSON.stringify({ type: 'error', message: 'Cannot continue session without session ID' }));
                    return;
                }

                const sdk = await import('@anthropic-ai/claude-agent-sdk');
                const options: any = {
                    resume: currentSessionId,
                };
                const queryHandle = sdk.query({
                    prompt: msg.content || '',
                    options,
                });

                session.queryHandle = queryHandle;
                session.queryIterator = queryHandle[Symbol.asyncIterator]();
                this.runMessageLoop(peer, session);
            }
        } catch (err: any) {
            peer.send(JSON.stringify({ type: 'error', message: `Failed to send message: ${err.message}` }));
        }
    }

    /* ── Cancel ─────────────────────────────────────────────── */

    private static async handleCancel(peer: any, session: SessionState) {
        session.active = false;
        try { session.queryHandle?.close(); } catch { /* noop */ }
        peer.send(JSON.stringify({ type: 'cancelled' }));
    }

    /* ── Event forwarding ────────────────────────────────────── */

    private static forwardToClient(peer: any, message: any) {
        if (message.type === 'assistant') {
            // Extract text content from assistant message
            let content = '';
            const msg = message.message;
            if (msg?.content) {
                if (Array.isArray(msg.content)) {
                    content = msg.content.map((part: any) => part.text || '').join('');
                } else if (typeof msg.content === 'string') {
                    content = msg.content;
                }
            }
            peer.send(JSON.stringify({ type: 'delta', content }));

            // Forward tool_use content blocks from the raw BetaMessage
            if (msg?.content && Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === 'tool_use' && (part.name === 'Edit' || part.name === 'Write' || part.name === 'Read' || part.name === 'Bash')) {
                        peer.send(JSON.stringify({
                            type: 'tool_use',
                            name: part.name,
                            input: part.input,
                            tool_use_id: part.id,
                        }));
                    }
                }
            }
        } else if (message.type === 'tool_use_summary') {
            peer.send(JSON.stringify({
                type: 'tool_use_summary',
                summary: message.summary,
            }));
        } else if (message.type === 'result') {
            peer.send(JSON.stringify({
                type: 'done',
                subtype: message.subtype,
                result: message.result,
                totalCostUsd: message.total_cost_usd,
                numTurns: message.num_turns,
            }));
        } else if (message.type === 'system') {
            peer.send(JSON.stringify({
                type: 'system',
                subtype: message.subtype,
                sessionId: message.session_id,
                data: message.data,
            }));
        } else if (message.type === 'user') {
            peer.send(JSON.stringify({
                type: 'user',
                content: message.message,
            }));
        } else if (message.type === 'commands_changed') {
            peer.send(JSON.stringify({
                type: 'commands_changed',
                commands: message.commands,
            }));
        } else {
            // Forward unknown types as raw
            peer.send(JSON.stringify({ type: 'raw', content: message }));
        }
    }

    static getActiveSessionCount(): number {
        return this.sessions.size;
    }
}
