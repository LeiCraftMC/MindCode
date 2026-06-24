import { Logger } from '../../utils/logger';
import { AuthHandler } from '../api/utils/authHandler';
import type { ParsedConfig } from '../../utils/config';
import type { Message } from 'crossws';
import type { Options, Query } from '@anthropic-ai/claude-agent-sdk';
import path from 'node:path';
import { tmpdir } from 'node:os';

export interface ClientAttachment {
    name: string;
    mediaType: string;
    /** base64-encoded file bytes */
    data: string;
}

export interface ClientToServerMessage {
    type: 'auth' | 'start' | 'message' | 'cancel';
    token?: string;
    prompt?: string;
    projectPath?: string;
    model?: string;
    effort?: string;
    content?: string;
    resume?: string;
    attachments?: ClientAttachment[];
}

/** Options captured at session start and reused for every follow-up (resumed) turn. */
interface StartOptions {
    cwd: string;
    model?: string;
    effort?: Options['effort'];
    allowedTools?: string[];
    maxTurns?: number;
    maxBudgetUsd?: number;
    pathToClaudeCodeExecutable?: string;
}

export interface SessionState {
    peer: any;
    userId: number;
    /** Bearer token captured at auth, re-validated before every privileged action. */
    token: string | null;
    sessionId: string | null;
    queryHandle: Query | null;
    /** True while a turn is actively streaming from the SDK. */
    running: boolean;
    /** False once the socket is closing/closed — stops the message loop. */
    active: boolean;
    options: StartOptions | null;
}

export class ClaudeSessionRunner {
    private static sessions = new Map<any, SessionState>();
    private static config: ParsedConfig | null = null;

    static configure(config: ParsedConfig) {
        this.config = config;
    }

    static async stop() {
        for (const session of this.sessions.values()) {
            session.active = false;
            session.running = false;
            try { session.queryHandle?.close(); } catch { /* noop */ }
        }
        this.sessions.clear();
        Logger.info('Claude session runner stopped.');
    }

    static async handleOpen(peer: any) {
        this.sessions.set(peer, {
            peer,
            userId: 0,
            token: null,
            sessionId: null,
            queryHandle: null,
            running: false,
            active: true,
            options: null,
        });
    }

    static async handleClose(peer: any) {
        const session = this.sessions.get(peer);
        if (!session) return;
        session.active = false;
        session.running = false;
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
        const token = msg.token || '';
        const authContext = await AuthHandler.getAuthContext(token);
        if (!authContext || !(await AuthHandler.isValidAuthContext(authContext))) {
            peer.close(4001, 'Invalid or expired token');
            return;
        }
        session.userId = authContext.user_id;
        session.token = token;
        peer.send(JSON.stringify({ type: 'auth_ok' }));
    }

    /**
     * Re-validate the stored token before every privileged action. Unlike the REST API,
     * a WebSocket stays open for a long time; without this, a logout / password change /
     * admin reset / expiry would have no effect while the socket is alive.
     */
    private static async ensureStillAuthed(peer: any, session: SessionState): Promise<boolean> {
        if (!session.token) {
            peer.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return false;
        }
        const authContext = await AuthHandler.getAuthContext(session.token);
        if (!authContext || !(await AuthHandler.isValidAuthContext(authContext))) {
            peer.close(4001, 'Session is no longer valid');
            return false;
        }
        session.userId = authContext.user_id;
        return true;
    }

    /* ── Start session ──────────────────────────────────────── */

    private static async handleStart(peer: any, session: SessionState, msg: ClientToServerMessage) {
        if (!(await this.ensureStillAuthed(peer, session))) return;

        if (session.running) {
            peer.send(JSON.stringify({ type: 'error', message: 'Claude is still responding. Please wait.' }));
            return;
        }

        // Validate the project path. (Trusted-team deployment: we don't sandbox per-user,
        // but we still reject obviously invalid input rather than passing it to the SDK.)
        let projectPath = process.cwd();
        if (msg.projectPath !== undefined) {
            if (typeof msg.projectPath !== 'string' || !msg.projectPath.startsWith('/')) {
                peer.send(JSON.stringify({ type: 'error', message: 'projectPath must be an absolute path' }));
                return;
            }
            projectPath = msg.projectPath;
        }

        session.options = {
            cwd: projectPath,
            model: msg.model || this.config?.MINDCODE_CLAUDE_DEFAULT_MODEL || undefined,
            effort: (msg.effort || this.config?.MINDCODE_CLAUDE_DEFAULT_EFFORT || undefined) as Options['effort'],
            allowedTools: this.config?.MINDCODE_CLAUDE_ALLOWED_TOOLS?.split(',').map(s => s.trim()) || undefined,
            maxTurns: this.config?.MINDCODE_CLAUDE_MAX_TURNS ? parseInt(this.config.MINDCODE_CLAUDE_MAX_TURNS) : undefined,
            maxBudgetUsd: this.config?.MINDCODE_CLAUDE_MAX_BUDGET_USD ? parseFloat(this.config.MINDCODE_CLAUDE_MAX_BUDGET_USD) : undefined,
            pathToClaudeCodeExecutable: this.config?.MINDCODE_CLAUDE_BINARY_PATH || undefined,
        };

        // Resume an existing session, or create a new one.
        const sessionUuid = msg.resume || crypto.randomUUID();
        session.sessionId = sessionUuid;

        peer.send(JSON.stringify({ type: 'init', sessionId: sessionUuid }));

        const { prompt, dirs } = await this.buildPrompt(msg.prompt || '', msg.attachments);
        await this.runTurn(peer, session, prompt, !!msg.resume, dirs);
    }

    /* ── Run a single turn (initial or resumed) ──────────────── */

    private static async runTurn(peer: any, session: SessionState, prompt: string, resume: boolean, extraDirs: string[] = []) {
        if (!session.options || !session.sessionId) {
            peer.send(JSON.stringify({ type: 'error', message: 'No active session' }));
            return;
        }

        const base = session.options;
        const options: Options = {
            cwd: base.cwd,
            model: base.model,
            effort: base.effort,
            allowedTools: base.allowedTools,
            maxTurns: base.maxTurns,
            maxBudgetUsd: base.maxBudgetUsd,
            pathToClaudeCodeExecutable: base.pathToClaudeCodeExecutable,
            // Grant read access to attachment temp dirs (outside the project cwd).
            ...(extraDirs.length ? { additionalDirectories: extraDirs } : {}),
            ...(resume ? { resume: session.sessionId } : { sessionId: session.sessionId }),
        };

        // Drop undefined values so the SDK uses its own defaults.
        const optionsRecord = options as Record<string, unknown>;
        for (const key of Object.keys(optionsRecord)) {
            if (optionsRecord[key] === undefined) delete optionsRecord[key];
        }

        // Close any leftover handle before starting a new turn (prevents leaking the old subprocess).
        try { session.queryHandle?.close(); } catch { /* noop */ }

        let handle: Query;
        try {
            const sdk = await import('@anthropic-ai/claude-agent-sdk');
            handle = sdk.query({ prompt, options });
        } catch (err) {
            Logger.error('Failed to start Claude SDK query:', err);
            if (session.active) {
                peer.send(JSON.stringify({ type: 'error', message: 'Failed to start Claude.' }));
            }
            return;
        }

        session.queryHandle = handle;
        session.running = true;

        try {
            for await (const value of handle) {
                if (!session.active) break;
                if (!value) continue;

                this.forwardToClient(peer, value);

                if (value.type === 'result') break;
            }
        } catch (err) {
            Logger.error('Error in Claude SDK message loop:', err);
            // Only surface an error if the turn wasn't deliberately cancelled.
            if (session.active && session.running) {
                peer.send(JSON.stringify({ type: 'error', message: 'Claude encountered an error.' }));
            }
        } finally {
            session.running = false;
            try { handle.close(); } catch { /* noop */ }
            if (session.queryHandle === handle) session.queryHandle = null;
        }
    }

    /* ── User message (follow-up turn) ──────────────────────── */

    private static async handleUserMessage(peer: any, session: SessionState, msg: ClientToServerMessage) {
        if (!(await this.ensureStillAuthed(peer, session))) return;

        if (!session.sessionId || !session.options) {
            peer.send(JSON.stringify({ type: 'error', message: 'No active session' }));
            return;
        }

        if (session.running) {
            peer.send(JSON.stringify({ type: 'error', message: 'Claude is still responding. Please wait.' }));
            return;
        }

        // Apply model/effort changes (from the config panel) to subsequent turns.
        if (msg.model) session.options.model = msg.model;
        if (msg.effort) session.options.effort = msg.effort as Options['effort'];

        // Each follow-up is a fresh resumed query — a string prompt is single-shot, so the
        // SDK's streamInput path can never drive multi-turn here. Resume-by-sessionId does.
        const { prompt, dirs } = await this.buildPrompt(msg.content || '', msg.attachments);
        await this.runTurn(peer, session, prompt, true, dirs);
    }

    /* ── Attachments ─────────────────────────────────────────── */

    /**
     * Persists any client attachments to a temp dir and appends their paths to the prompt
     * so the agent can Read them (works for images and text/binary files alike). Returns
     * the temp dir so the caller can grant the agent read access via additionalDirectories
     * (it lives outside the project cwd, which the agent cannot otherwise reach).
     */
    private static async buildPrompt(text: string, attachments?: ClientAttachment[]): Promise<{ prompt: string; dirs: string[] }> {
        if (!attachments?.length) return { prompt: text, dirs: [] };
        try {
            const { paths, dir } = await this.saveAttachments(attachments);
            if (!paths.length) return { prompt: text, dirs: [] };
            const list = paths.map(p => `- ${p}`).join('\n');
            const note = `[The user attached the following file(s). Use the Read tool to view them as needed:\n${list}\n]`;
            return { prompt: text.trim() ? `${text}\n\n${note}` : note, dirs: [dir] };
        } catch (err) {
            Logger.error('Failed to save attachments:', err);
            return { prompt: text, dirs: [] };
        }
    }

    private static async saveAttachments(attachments: ClientAttachment[]): Promise<{ paths: string[]; dir: string }> {
        const dir = path.join(tmpdir(), 'mindcode-attachments', crypto.randomUUID());
        const paths: string[] = [];
        for (const att of attachments) {
            if (!att?.data) continue;
            const safeName = (att.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) || 'file';
            const filePath = path.join(dir, safeName);
            await Bun.write(filePath, Buffer.from(att.data, 'base64'));
            paths.push(filePath);
        }
        return { paths, dir };
    }

    /* ── Cancel ─────────────────────────────────────────────── */

    private static async handleCancel(peer: any, session: SessionState) {
        // Stop the in-flight turn but keep the session alive so the user can continue.
        session.running = false;
        try { session.queryHandle?.close(); } catch { /* noop */ }
        session.queryHandle = null;
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

            // Forward all tool_use content blocks from the raw BetaMessage so the UI can
            // render every tool call (not just file edits).
            if (msg?.content && Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === 'tool_use') {
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
        } else if (message.type === 'system' && message.subtype === 'commands_changed') {
            // The SDK delivers available slash commands as a system/commands_changed
            // message — forward them so the chat input's "/" autocomplete can populate.
            peer.send(JSON.stringify({
                type: 'commands_changed',
                commands: message.commands,
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
        } else {
            // Unknown SDK message types are logged server-side only — forwarding the raw
            // object can leak absolute host paths, the binary path and env details to the browser.
            Logger.debug('Unhandled Claude SDK message type:', message?.type);
        }
    }
}
