import { z } from 'zod';

// ──────────────────────────────────────────────
// Tool input value — constrained to types that actually appear
// ──────────────────────────────────────────────

/** A flat record used inside tool input arrays (e.g. TodoWrite.todos items) */
const ToolInputObject = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

/** All value types that appear in tool_use.input fields */
const ToolInputValue = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(ToolInputObject),
]);

// ──────────────────────────────────────────────
// Content block types (request-side: what users send)
// ──────────────────────────────────────────────

const TextBlockParam = z.object({
    type: z.literal('text'),
    text: z.string(),
});

const ImageBlockParam = z.object({
    type: z.literal('image'),
    source: z.object({
        type: z.enum(['base64', 'url']),
        media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
        data: z.string().optional(),
        url: z.string().optional(),
    }),
});

const ToolUseBlockParam = z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), ToolInputValue),
});

const ToolResultContentBlock = z.object({
    type: z.literal('text'),
    text: z.string(),
});

const ToolResultBlockParam = z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.union([
        z.string(),
        z.array(ToolResultContentBlock),
    ]).optional(),
    is_error: z.boolean().optional(),
});

const ThinkingBlockParam = z.object({
    type: z.literal('thinking'),
    thinking: z.string(),
    signature: z.string().optional(),
});

const RedactedThinkingBlockParam = z.object({
    type: z.literal('redacted_thinking'),
    data: z.string(),
});

const ContentBlockParam = z.discriminatedUnion('type', [
    TextBlockParam,
    ImageBlockParam,
    ToolUseBlockParam,
    ToolResultBlockParam,
    ThinkingBlockParam,
    RedactedThinkingBlockParam,
]);

// ──────────────────────────────────────────────
// Content block types (response-side: what the API returns)
// ──────────────────────────────────────────────

const TextBlock = z.object({
    type: z.literal('text'),
    text: z.string(),
});

const ThinkingBlock = z.object({
    type: z.literal('thinking'),
    thinking: z.string(),
    signature: z.string(),
});

const RedactedThinkingBlock = z.object({
    type: z.literal('redacted_thinking'),
    data: z.string(),
});

const ToolUseBlock = z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), ToolInputValue),
});

const ServerToolUsage = z.object({
    web_search_requests: z.number(),
    web_fetch_requests: z.number(),
});

const CacheCreation = z.object({
    ephemeral_1h_input_tokens: z.number(),
    ephemeral_5m_input_tokens: z.number(),
});

// ── Iteration usage types (from BetaIterationsUsage) ──

const MessageIterationUsage = z.object({
    type: z.literal('message'),
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    cache_creation: CacheCreation.nullable(),
    model: z.string(),
});

const CompactionIterationUsage = z.object({
    type: z.literal('compaction'),
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    cache_creation: CacheCreation.nullable(),
});

const AdvisorMessageIterationUsage = z.object({
    type: z.literal('advisor_message'),
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    cache_creation: CacheCreation.nullable(),
    model: z.string(),
});

const FallbackMessageIterationUsage = z.object({
    type: z.literal('fallback_message'),
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    cache_creation: CacheCreation.nullable(),
    model: z.string(),
});

const IterationUsage = z.discriminatedUnion('type', [
    MessageIterationUsage,
    CompactionIterationUsage,
    AdvisorMessageIterationUsage,
    FallbackMessageIterationUsage,
]);

const IterationsUsage = z.array(IterationUsage).nullable();

const OutputTokensDetails = z.object({
    text_tokens: z.number().optional(),
    thinking_tokens: z.number().optional(),
}).nullable().optional();

const BetaUsage = z.object({
    input_tokens: z.number(),
    cache_creation_input_tokens: z.number().nullable(),
    cache_read_input_tokens: z.number().nullable(),
    output_tokens: z.number(),
    server_tool_use: ServerToolUsage.nullable().optional(),
    service_tier: z.enum(['standard', 'priority', 'batch']).nullable(),
    cache_creation: CacheCreation.nullable().optional(),
    inference_geo: z.string().nullable().optional(),
    iterations: IterationsUsage.optional(),
    output_tokens_details: OutputTokensDetails.optional(),
    speed: z.enum(['standard', 'fast']).nullable().optional(),
});

const ResponseContentBlock = z.discriminatedUnion('type', [
    TextBlock,
    ThinkingBlock,
    RedactedThinkingBlock,
    ToolUseBlock,
]);

// ──────────────────────────────────────────────
// MessageParam (user-role message content)
// ──────────────────────────────────────────────

const MessageParam = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.union([z.string(), z.array(ContentBlockParam)]),
});

// ──────────────────────────────────────────────
// BetaMessage (assistant-role message content)
// ──────────────────────────────────────────────

const BetaMessage = z.object({
    id: z.string(),
    type: z.literal('message'),
    role: z.literal('assistant'),
    content: z.array(ResponseContentBlock),
    model: z.string(),
    stop_reason: z.string().nullable(),
    stop_sequence: z.string().nullable(),
    usage: BetaUsage,
    stop_details: z.object({ type: z.literal('early') }).nullable().optional(),
});

// ──────────────────────────────────────────────
// SessionMessage — the top-level message in history
// ──────────────────────────────────────────────

const SessionMessage = z.object({
    type: z.enum(['user', 'assistant', 'system']),
    uuid: z.string(),
    session_id: z.string(),
    message: z.union([MessageParam, BetaMessage, z.record(z.string(), ToolInputValue)]),
    parent_tool_use_id: z.string().nullable(),
    timestamp: z.string().datetime().optional(),
});

// ──────────────────────────────────────────────
// Refined helpers for discriminated access
// ──────────────────────────────────────────────

const UserSessionMessage = SessionMessage.extend({
    type: z.literal('user'),
    message: MessageParam,
});

const AssistantSessionMessage = SessionMessage.extend({
    type: z.literal('assistant'),
    message: BetaMessage,
});

// ──────────────────────────────────────────────
// Full message history response
// ──────────────────────────────────────────────

const MessageHistory = z.array(SessionMessage);

// ──────────────────────────────────────────────
// Namespace — single public export
// ──────────────────────────────────────────────

export namespace MessageHistoryModel {

    // ── Content blocks ──

    export const TextContent = TextBlock;
    export type TextContent = z.infer<typeof TextContent>;

    export const ThinkingContent = ThinkingBlock;
    export type ThinkingContent = z.infer<typeof ThinkingBlock>;

    export const RedactedThinkingContent = RedactedThinkingBlock;
    export type RedactedThinkingContent = z.infer<typeof RedactedThinkingBlock>;

    export const ToolUseContent = ToolUseBlock;
    export type ToolUseContent = z.infer<typeof ToolUseContent>;

    export const ResponseContent = ResponseContentBlock;
    export type ResponseContent = z.infer<typeof ResponseContent>;

    // ── Request-side content ──

    export const TextContentParam = TextBlockParam;
    export type TextContentParam = z.infer<typeof TextContentParam>;

    export const ImageContentParam = ImageBlockParam;
    export type ImageContentParam = z.infer<typeof ImageContentParam>;

    export const ToolUseContentParam = ToolUseBlockParam;
    export type ToolUseContentParam = z.infer<typeof ToolUseBlockParam>;

    export const ToolResultContentParam = ToolResultBlockParam;
    export type ToolResultContentParam = z.infer<typeof ToolResultBlockParam>;

    export const ContentParam = ContentBlockParam;
    export type ContentParam = z.infer<typeof ContentParam>;

    // ── Usage ──

    export const Usage = BetaUsage;
    export type Usage = z.infer<typeof Usage>;

    export const CacheUsage = CacheCreation;
    export type CacheUsage = z.infer<typeof CacheUsage>;

    export const ServerToolUsageModel = ServerToolUsage;
    export type ServerToolUsageModel = z.infer<typeof ServerToolUsage>;

    // ── Iterations ──

    export const Iteration = IterationUsage;
    export type Iteration = z.infer<typeof Iteration>;

    export const Iterations = IterationsUsage;
    export type Iterations = z.infer<typeof Iterations>;

    // ── Messages ──

    export const UserMessage = MessageParam;
    export type UserMessage = z.infer<typeof UserMessage>;

    export const AssistantResponse = BetaMessage;
    export type AssistantResponse = z.infer<typeof AssistantResponse>;

    export const Entry = SessionMessage;
    export type Entry = z.infer<typeof Entry>;

    export const UserEntry = UserSessionMessage;
    export type UserEntry = z.infer<typeof UserEntry>;

    export const AssistantEntry = AssistantSessionMessage;
    export type AssistantEntry = z.infer<typeof AssistantEntry>;

    // ── History ──

    export const History = MessageHistory;
    export type History = z.infer<typeof History>;

    // ── Endpoint models ──

    export namespace GetMessages {
        export const Params = z.object({
            session_id: z.string(),
        });
        export type Params = z.infer<typeof Params>;

        export const Query = z.object({
            limit: z.coerce.number().min(1).max(500).default(100).optional(),
            offset: z.coerce.number().min(0).default(0).optional(),
        });
        export type Query = z.infer<typeof Query>;

        export const Response = z.object({
            messages: MessageHistory,
            total: z.number().int(),
        });
        export type Response = z.infer<typeof Response>;
    }
}
