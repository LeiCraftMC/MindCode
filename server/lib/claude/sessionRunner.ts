import { Logger } from '../../utils/logger';
import { AuthHandler } from '../api/utils/authHandler';
import type { ParsedConfig } from '../../utils/config';
import type { Message } from 'crossws';
import type {
    Options,
    Query,
    CanUseTool,
    OnUserDialog,
    OnElicitation,
    PermissionResult,
    UserDialogResult,
    ElicitationResult,
    SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { AskUserQuestionInput } from '@anthropic-ai/claude-agent-sdk/sdk-tools';
import type {
    ClientToServerMessage,
    StartClientMessage,
    MessageClientMessage,
    AuthClientMessage,
    PermissionResponseMessage,
    QuestionResponseMessage,
    DialogResponseMessage,
    ElicitationResponseMessage,
    PermissionDeniedMessage,
    PermissionRequestMessage,
    QuestionRequestMessage,
    DialogRequestMessage,
    ElicitationRequestMessage,
    PermissionUpdate as WSPermissionUpdate,
} from '#shared/types/claude-ws';
import path from 'node:path';
import { tmpdir } from 'node:os';

export interface ClientAttachment {
    name: string;
    mediaType: string;
    /** base64-encoded file bytes */
    data: string;
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

interface PendingRequest<T> {
    requestId: string;
    kind: 'permission' | 'question' | 'dialog' | 'elicitation';
    /** For question requests, the original SDK tool_use_id so the answer can be injected as the correct tool_result. */
    toolUseId?: string;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
    abortController: AbortController;
}

interface TurnContext {
    pending: Map<string, PendingRequest<any>>;
    /** Queued user messages waiting to be fed into the SDK via streamInput. */
    inputBuffer: SDKUserMessage[];
    /** Resolver for the streamInput generator when it is waiting for the next message. */
    inputResolver?: (msg: SDKUserMessage | undefined) => void;
    /** True once the input pump has been closed so we do not leak async work. */
    inputClosed: boolean;
    /** AbortController tied to the whole turn; triggered on cancel/close. */
    abortController: AbortController;
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
    /** Holds in-flight permission/question/dialog/elicitation requests for the current turn. */
    turn: TurnContext | null;
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
            this.clearTurn(session);
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
            turn: null,
        });
    }

    static async handleClose(peer: any) {
        const session = this.sessions.get(peer);
        if (!session) return;
        session.active = false;
        session.running = false;
        this.clearTurn(session);
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
            case 'permission_response':
                await this.handlePermissionResponse(peer, session, msg);
                break;
            case 'question_response':
                await this.handleQuestionResponse(peer, session, msg);
                break;
            case 'dialog_response':
                await this.handleDialogResponse(peer, session, msg);
                break;
            case 'elicitation_response':
                await this.handleElicitationResponse(peer, session, msg);
                break;
            default:
                peer.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${(msg as any).type}` }));
        }
    }

    /* ── Auth ────────────────────────────────────────────────── */

    private static async handleAuth(peer: any, session: SessionState, msg: AuthClientMessage) {
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

    private static async handleStart(peer: any, session: SessionState, msg: StartClientMessage) {
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

        // Clear any previous turn state before starting a new one.
        this.clearTurn(session);

        const base = session.options;
        const turnAbort = new AbortController();
        const turn: TurnContext = {
            pending: new Map(),
            inputBuffer: [],
            inputClosed: false,
            abortController: turnAbort,
        };
        session.turn = turn;

        const options: Options = {
            cwd: base.cwd,
            model: base.model,
            effort: base.effort,
            allowedTools: base.allowedTools,
            maxTurns: base.maxTurns,
            maxBudgetUsd: base.maxBudgetUsd,
            pathToClaudeCodeExecutable: base.pathToClaudeCodeExecutable,
            abortController: turnAbort,
            // Grant read access to attachment temp dirs (outside the project cwd).
            ...(extraDirs.length ? { additionalDirectories: extraDirs } : {}),
            ...(resume ? { resume: session.sessionId } : { sessionId: session.sessionId }),
            canUseTool: (toolName, input, opts) => this.parkPermissionRequest(peer, session, toolName, input, opts),
            onUserDialog: (request, opts) => this.parkDialogRequest(peer, session, request, opts),
            supportedDialogKinds: ['refusal_fallback_prompt', 'side_question'],
            onElicitation: (request, opts) => this.parkElicitationRequest(peer, session, request, opts),
            toolConfig: { askUserQuestion: { previewFormat: 'markdown' } },
            forwardSubagentText: true,
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
            this.clearTurn(session);
            return;
        }

        session.queryHandle = handle;
        session.running = true;

        // Start a background pump so we can inject tool_result answers mid-turn.
        this.startInputPump(session, turn, handle);

        try {
            for await (const value of handle) {
                if (!session.active) break;
                if (!value) continue;

                this.forwardToClient(peer, value, turn);

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
            this.clearTurn(session);
            try { handle.close(); } catch { /* noop */ }
            if (session.queryHandle === handle) session.queryHandle = null;
        }
    }

    /* ── User message (follow-up turn) ──────────────────────── */

    private static async handleUserMessage(peer: any, session: SessionState, msg: MessageClientMessage) {
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
        this.clearTurn(session);
        try { session.queryHandle?.close(); } catch { /* noop */ }
        session.queryHandle = null;
        peer.send(JSON.stringify({ type: 'cancelled' }));
    }

    /* ── Parking SDK requests ───────────────────────────────── */

    private static parkPermissionRequest(
        peer: any,
        session: SessionState,
        toolName: string,
        input: Record<string, unknown>,
        opts: Parameters<CanUseTool>[2]
    ): Promise<PermissionResult> {
        const turn = session.turn;
        if (!turn) return Promise.resolve({ behavior: 'deny', message: 'No active turn' });

        const requestId = crypto.randomUUID();
        const abortController = new AbortController();

        // If the SDK signals abort, reject the promise so the callback unwinds.
        opts.signal?.addEventListener('abort', () => {
            abortController.abort();
            const pending = turn.pending.get(requestId);
            if (pending) {
                pending.reject(new Error('SDK aborted permission request'));
                turn.pending.delete(requestId);
            }
        }, { once: true });

        const promise = new Promise<PermissionResult>((resolve, reject) => {
            turn.pending.set(requestId, {
                requestId,
                kind: 'permission',
                resolve,
                reject,
                abortController,
            });
        });

        const msg: PermissionRequestMessage = {
            type: 'permission_request',
            requestId,
            toolName,
            toolUseId: opts.toolUseID,
            input: this.stripUnsafePaths(input),
            title: opts.title,
            displayName: opts.displayName,
            description: opts.description,
            blockedPath: opts.blockedPath,
            decisionReason: opts.decisionReason,
            decisionReasonType: undefined, // SDK does not expose this on CanUseTool opts directly
            classifierApprovable: undefined,
            agentId: opts.agentID,
            permissionSuggestions: opts.suggestions ? this.toWSPermissionUpdates(opts.suggestions) : undefined,
        };

        this.sendToClient(peer, msg);
        return promise;
    }

    private static parkDialogRequest(
        peer: any,
        session: SessionState,
        request: Parameters<OnUserDialog>[0],
        opts: Parameters<OnUserDialog>[1]
    ): Promise<UserDialogResult> {
        const turn = session.turn;
        if (!turn) return Promise.resolve({ behavior: 'cancelled' });

        const requestId = crypto.randomUUID();
        const abortController = new AbortController();

        opts.signal?.addEventListener('abort', () => {
            abortController.abort();
            const pending = turn.pending.get(requestId);
            if (pending) {
                pending.reject(new Error('SDK aborted dialog request'));
                turn.pending.delete(requestId);
            }
        }, { once: true });

        const promise = new Promise<UserDialogResult>((resolve, reject) => {
            turn.pending.set(requestId, {
                requestId,
                kind: 'dialog',
                resolve,
                reject,
                abortController,
            });
        });

        const msg: DialogRequestMessage = {
            type: 'dialog_request',
            requestId,
            dialogKind: request.dialogKind,
            payload: this.stripUnsafePaths(request.payload),
            toolUseId: request.toolUseID,
        };

        this.sendToClient(peer, msg);
        return promise;
    }

    private static parkElicitationRequest(
        peer: any,
        session: SessionState,
        request: Parameters<OnElicitation>[0],
        opts: Parameters<OnElicitation>[1]
    ): Promise<ElicitationResult> {
        const turn = session.turn;
        if (!turn) return Promise.resolve({ action: 'decline' as const });

        const requestId = crypto.randomUUID();
        const abortController = new AbortController();

        opts.signal?.addEventListener('abort', () => {
            abortController.abort();
            const pending = turn.pending.get(requestId);
            if (pending) {
                pending.reject(new Error('SDK aborted elicitation request'));
                turn.pending.delete(requestId);
            }
        }, { once: true });

        const promise = new Promise<ElicitationResult>((resolve, reject) => {
            turn.pending.set(requestId, {
                requestId,
                kind: 'elicitation',
                resolve,
                reject,
                abortController,
            });
        });

        const msg: ElicitationRequestMessage = {
            type: 'elicitation_request',
            requestId,
            serverName: request.serverName,
            message: request.message,
            mode: request.mode || 'form',
            url: request.url,
            elicitationId: request.elicitationId,
            requestedSchema: request.requestedSchema,
            title: request.title,
            displayName: request.displayName,
            description: request.description,
        };

        this.sendToClient(peer, msg);
        return promise;
    }

    /* ── Client responses ────────────────────────────────────── */

    private static async handlePermissionResponse(peer: any, session: SessionState, msg: PermissionResponseMessage) {
        if (!(await this.ensureStillAuthed(peer, session))) return;
        const turn = session.turn;
        if (!turn) return;
        const pending = turn.pending.get(msg.requestId);
        if (!pending || pending.kind !== 'permission') return;

        const result: PermissionResult = msg.behavior === 'allow'
            ? {
                behavior: 'allow',
                updatedInput: msg.updatedInput ?? {},
                updatedPermissions: msg.updatedPermissions ? this.toSDKPermissionUpdates(msg.updatedPermissions) : [],
            }
            : {
                behavior: 'deny',
                message: msg.message || 'User denied permission',
            };

        pending.resolve(result);
        turn.pending.delete(msg.requestId);
    }

    private static async handleQuestionResponse(peer: any, session: SessionState, msg: QuestionResponseMessage) {
        if (!(await this.ensureStillAuthed(peer, session))) return;
        const turn = session.turn;
        if (!turn) return;
        const pending = turn.pending.get(msg.requestId);
        if (!pending || pending.kind !== 'question') return;

        // Resolve the parking promise so the runner knows the question was answered.
        pending.resolve(undefined);
        turn.pending.delete(msg.requestId);

        // Inject the answer as a tool_result user message via streamInput.
        const toolUseId = pending.toolUseId || pending.requestId;
        const answer: SDKUserMessage = {
            type: 'user',
            message: {
                role: 'user',
                content: [{
                    type: 'tool_result',
                    tool_use_id: toolUseId,
                    content: JSON.stringify({
                        answers: msg.answers,
                        response: msg.response,
                        annotations: msg.annotations,
                    }),
                }],
            },
            parent_tool_use_id: toolUseId,
        };

        this.injectUserMessage(turn, answer);
    }

    private static async handleDialogResponse(peer: any, session: SessionState, msg: DialogResponseMessage) {
        if (!(await this.ensureStillAuthed(peer, session))) return;
        const turn = session.turn;
        if (!turn) return;
        const pending = turn.pending.get(msg.requestId);
        if (!pending || pending.kind !== 'dialog') return;

        const result: UserDialogResult = msg.behavior === 'completed'
            ? { behavior: 'completed', result: msg.result }
            : { behavior: 'cancelled' };

        pending.resolve(result);
        turn.pending.delete(msg.requestId);
    }

    private static async handleElicitationResponse(peer: any, session: SessionState, msg: ElicitationResponseMessage) {
        if (!(await this.ensureStillAuthed(peer, session))) return;
        const turn = session.turn;
        if (!turn) return;
        const pending = turn.pending.get(msg.requestId);
        if (!pending || pending.kind !== 'elicitation') return;

        const result: ElicitationResult = {
            action: msg.action,
            content: msg.content,
        };

        pending.resolve(result);
        turn.pending.delete(msg.requestId);
    }

    /* ── streamInput pump ────────────────────────────────────── */

    private static startInputPump(session: SessionState, turn: TurnContext, handle: Query) {
        const source = (async function* () {
            while (session.active && !turn.inputClosed) {
                if (turn.inputBuffer.length) {
                    yield turn.inputBuffer.shift()!;
                    continue;
                }
                const msg = await new Promise<SDKUserMessage | undefined>((resolve) => {
                    turn.inputResolver = resolve;
                });
                if (!msg) break;
                yield msg;
            }
        })();

        handle.streamInput(source).catch((err) => {
            Logger.error('Claude SDK streamInput error:', err);
        });
    }

    private static injectUserMessage(turn: TurnContext, msg: SDKUserMessage) {
        if (turn.inputClosed) return;
        if (turn.inputResolver) {
            const resolve = turn.inputResolver;
            turn.inputResolver = undefined;
            resolve(msg);
        } else {
            turn.inputBuffer.push(msg);
        }
    }

    /* ── Event forwarding ────────────────────────────────────── */

    private static forwardToClient(peer: any, message: any, turn: TurnContext) {
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
            this.sendToClient(peer, { type: 'delta', content });

            // Forward all tool_use content blocks from the raw BetaMessage so the UI can
            // render every tool call (not just file edits).
            if (msg?.content && Array.isArray(msg.content)) {
                for (const part of msg.content) {
                    if (part.type === 'tool_use') {
                        this.sendToClient(peer, {
                            type: 'tool_use',
                            name: part.name,
                            input: part.input,
                            tool_use_id: part.id,
                        });

                        if (part.name === 'AskUserQuestion') {
                            this.emitQuestionRequest(peer, sessionRunnerFromPeer(peer), turn, part);
                        }
                    }
                }
            }
        } else if (message.type === 'tool_use_summary') {
            this.sendToClient(peer, {
                type: 'tool_use_summary',
                summary: message.summary,
            });
        } else if (message.type === 'result') {
            this.sendToClient(peer, {
                type: 'done',
                subtype: message.subtype,
                result: message.result,
                totalCostUsd: message.total_cost_usd,
                numTurns: message.num_turns,
            });
        } else if (message.type === 'system' && message.subtype === 'commands_changed') {
            // The SDK delivers available slash commands as a system/commands_changed
            // message — forward them so the chat input's "/" autocomplete can populate.
            this.sendToClient(peer, {
                type: 'commands_changed',
                commands: message.commands,
            });
        } else if (message.type === 'system' && message.subtype === 'permission_denied') {
            const denied: PermissionDeniedMessage = {
                type: 'permission_denied',
                toolName: message.tool_name,
                toolUseId: message.tool_use_id,
                reason: message.decision_reason || message.message,
            };
            this.sendToClient(peer, denied);
        } else if (message.type === 'user') {
            // The SDK may stream user messages containing tool_result blocks (subagent/tool
            // answers while a turn is still running). Forward them so they render live.
            const userMsg = message.message;
            if (Array.isArray(userMsg?.content)) {
                for (const part of userMsg.content) {
                    if (part.type === 'tool_result' && part.tool_use_id) {
                        const resultText = typeof part.content === 'string'
                            ? part.content
                            : Array.isArray(part.content)
                                ? part.content.map((p: any) => typeof p === 'string' ? p : p?.text || '').join('')
                                : '';
                        this.sendToClient(peer, {
                            type: 'tool_result',
                            tool_use_id: part.tool_use_id,
                            content: resultText,
                            isError: !!part.is_error,
                        });
                    } else if (part.type === 'text') {
                        this.sendToClient(peer, {
                            type: 'user',
                            content: part.text,
                        });
                    }
                }
            } else if (typeof userMsg?.content === 'string') {
                this.sendToClient(peer, {
                    type: 'user',
                    content: userMsg.content,
                });
            }
        } else if (message.type === 'system') {
            this.sendToClient(peer, {
                type: 'system',
                subtype: message.subtype,
                sessionId: message.session_id,
                data: message.data,
            });
        } else if (message.type === 'control_request') {
            // control_request payloads are handled by the parked SDK callbacks
            // (canUseTool/onUserDialog/onElicitation). Nothing to forward here.
            return;
        } else {
            // Unknown SDK message types are logged server-side only — forwarding the raw
            // object can leak absolute host paths, the binary path and env details to the browser.
            Logger.debug('Unhandled Claude SDK message type:', message?.type);
        }
    }

    private static emitQuestionRequest(peer: any, session: SessionState | undefined, turn: TurnContext, part: any) {
        if (!session) return;
        const requestId = crypto.randomUUID();
        const abortController = new AbortController();

        const toolUseId = part.id as string;
        const promise = new Promise<void>((resolve, reject) => {
            turn.pending.set(requestId, {
                requestId,
                kind: 'question',
                toolUseId,
                resolve,
                reject,
                abortController,
            });
        });

        // If the turn is cancelled before the user answers, resolve so the pump is not blocked.
        abortController.signal.addEventListener('abort', () => {
            const pending = turn.pending.get(requestId);
            if (pending) {
                pending.resolve(undefined);
                turn.pending.delete(requestId);
            }
        }, { once: true });

        const input = part.input as AskUserQuestionInput | undefined;
        const msg: QuestionRequestMessage = {
            type: 'question_request',
            requestId,
            toolUseId: part.id,
            questions: (input?.questions || []).map(q => ({
                question: q.question,
                header: q.header,
                options: q.options.map(o => ({
                    label: o.label,
                    description: o.description,
                    preview: o.preview,
                })),
                multiSelect: q.multiSelect,
            })),
        };

        this.sendToClient(peer, msg);

        // Start a guard so the question cannot stall the turn forever if ignored by the client.
        promise.catch(() => {}).finally(() => {
            if (turn.pending.get(requestId)?.kind === 'question') {
                turn.pending.delete(requestId);
            }
        });
    }

    /* ── Helpers ─────────────────────────────────────────────── */

    private static clearTurn(session: SessionState) {
        const turn = session.turn;
        if (!turn) return;

        turn.inputClosed = true;
        if (turn.inputResolver) {
            turn.inputResolver(undefined);
            turn.inputResolver = undefined;
        }

        for (const pending of turn.pending.values()) {
            pending.abortController.abort();
            try { pending.reject(new Error('Turn ended')); } catch { /* noop */ }
        }
        turn.pending.clear();

        try { turn.abortController.abort(); } catch { /* noop */ }
        session.turn = null;
    }

    private static sendToClient(peer: any, msg: Record<string, any>) {
        try {
            peer.send(JSON.stringify(msg));
        } catch (err) {
            Logger.error('Failed to send WebSocket message:', err);
        }
    }

    private static stripUnsafePaths(value: unknown): any {
        if (value === null || value === undefined) return value;
        if (typeof value === 'string') {
            // Remove anything that looks like an absolute path.
            return value.replace(/\/[a-zA-Z0-9_.\-/]+/g, '[path]');
        }
        if (Array.isArray(value)) return value.map(v => this.stripUnsafePaths(v));
        if (typeof value === 'object') {
            const out: Record<string, any> = {};
            for (const [k, v] of Object.entries(value)) {
                if (k === 'cwd' || k === 'transcript_path' || k === 'session_id' || k === 'uuid') continue;
                out[k] = this.stripUnsafePaths(v);
            }
            return out;
        }
        return value;
    }

    private static toWSPermissionUpdates(updates: NonNullable<Parameters<CanUseTool>[2]['suggestions']>): WSPermissionUpdate[] {
        return updates.map(u => u as unknown as WSPermissionUpdate);
    }

    private static toSDKPermissionUpdates(updates: WSPermissionUpdate[]): any[] {
        return updates.map(u => u as any);
    }
}

/** Resolve a session from a peer reference when the static runner needs it mid-callback. */
function sessionRunnerFromPeer(peer: any): SessionState | undefined {
    return ClaudeSessionRunner['sessions'].get(peer);
}
