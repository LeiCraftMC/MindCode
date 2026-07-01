/**
 * Shared JSON-over-WebSocket protocol types for the Claude Code integration.
 * These types are used by both the Nuxt frontend and the Nitro backend, so
 * they must stay dependency-free and serializable.
 */

export interface PermissionUpdate {
    type: 'addRules' | 'replaceRules' | 'removeRules' | 'setMode' | 'addDirectories' | 'removeDirectories';
    rules?: Array<{ toolName: string; ruleContent?: string }>;
    behavior?: 'allow' | 'deny' | 'ask';
    mode?: string;
    destination?: 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg';
    directories?: string[];
}

// ── Server → Client messages ────────────────────────────────────────

export interface DeltaMessage {
    type: 'delta';
    content: string;
}

export interface ToolUseMessage {
    type: 'tool_use';
    name: string;
    input: Record<string, any>;
    tool_use_id: string;
}

export interface ToolUseSummaryMessage {
    type: 'tool_use_summary';
    summary: string;
}

export interface DoneMessage {
    type: 'done';
    subtype?: string;
    result?: string;
    totalCostUsd?: number;
    numTurns?: number;
}

export interface CancelledMessage {
    type: 'cancelled';
}

export interface ErrorMessage {
    type: 'error';
    message: string;
}

export interface InitMessage {
    type: 'init';
    sessionId: string;
}

export interface AuthOkMessage {
    type: 'auth_ok';
}

export interface CommandsChangedMessage {
    type: 'commands_changed';
    commands: Array<{ name: string; description: string; argumentHint?: string; aliases?: string[] }>;
}

export interface SystemMessage {
    type: 'system';
    subtype: string;
    sessionId?: string;
    data?: Record<string, any>;
}

export interface UserMessage {
    type: 'user';
    content: string;
}

export interface PermissionRequestMessage {
    type: 'permission_request';
    requestId: string;
    toolName: string;
    toolUseId: string;
    input?: Record<string, any>;
    title?: string;
    displayName?: string;
    description?: string;
    blockedPath?: string;
    decisionReason?: string;
    decisionReasonType?: string;
    classifierApprovable?: boolean;
    agentId?: string;
    permissionSuggestions?: PermissionUpdate[];
}

export interface AskUserQuestion {
    question: string;
    header: string;
    options: Array<{
        label: string;
        description: string;
        preview?: string;
    }>;
    multiSelect: boolean;
}

export interface QuestionRequestMessage {
    type: 'question_request';
    requestId: string;
    toolUseId: string;
    questions: AskUserQuestion[];
}

export interface DialogRequestMessage {
    type: 'dialog_request';
    requestId: string;
    dialogKind: string;
    payload: Record<string, any>;
    toolUseId?: string;
}

export interface ElicitationRequestMessage {
    type: 'elicitation_request';
    requestId: string;
    serverName: string;
    message: string;
    mode: 'form' | 'url';
    url?: string;
    elicitationId?: string;
    requestedSchema?: Record<string, any>;
    title?: string;
    displayName?: string;
    description?: string;
}

export interface PermissionDeniedMessage {
    type: 'permission_denied';
    toolName: string;
    toolUseId: string;
    reason?: string;
}

export type ServerToClientMessage =
    | DeltaMessage
    | ToolUseMessage
    | ToolUseSummaryMessage
    | DoneMessage
    | CancelledMessage
    | ErrorMessage
    | InitMessage
    | AuthOkMessage
    | CommandsChangedMessage
    | SystemMessage
    | UserMessage
    | PermissionRequestMessage
    | QuestionRequestMessage
    | DialogRequestMessage
    | ElicitationRequestMessage
    | PermissionDeniedMessage;

// ── Client → Server messages ───────────────────────────────────────

export interface AuthClientMessage {
    type: 'auth';
    token?: string;
}

export interface StartClientMessage {
    type: 'start';
    token?: string;
    prompt?: string;
    projectPath?: string;
    model?: string;
    effort?: string;
    resume?: string;
    attachments?: Array<{ name: string; mediaType: string; data: string }>;
}

export interface MessageClientMessage {
    type: 'message';
    content?: string;
    model?: string;
    effort?: string;
    attachments?: Array<{ name: string; mediaType: string; data: string }>;
}

export interface CancelClientMessage {
    type: 'cancel';
}

export interface PermissionResponseMessage {
    type: 'permission_response';
    requestId: string;
    behavior: 'allow' | 'deny';
    message?: string;
    updatedInput?: Record<string, any>;
    updatedPermissions?: PermissionUpdate[];
}

export interface QuestionResponseMessage {
    type: 'question_response';
    requestId: string;
    answers: Record<string, string>;
    response?: string;
    annotations?: Record<string, { preview?: string; notes?: string }>;
}

export interface DialogResponseMessage {
    type: 'dialog_response';
    requestId: string;
    behavior: 'completed' | 'cancelled';
    result?: any;
}

export interface ElicitationResponseMessage {
    type: 'elicitation_response';
    requestId: string;
    action: 'accept' | 'decline' | 'cancel';
    content?: Record<string, any>;
}

export type ClientToServerMessage =
    | AuthClientMessage
    | StartClientMessage
    | MessageClientMessage
    | CancelClientMessage
    | PermissionResponseMessage
    | QuestionResponseMessage
    | DialogResponseMessage
    | ElicitationResponseMessage;
