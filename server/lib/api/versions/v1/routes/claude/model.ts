import { z } from 'zod';

export namespace ClaudeModel {

    export const Session = z.object({
        sessionId: z.string(),
        summary: z.string(),
        lastModified: z.number(),
        customTitle: z.string().optional(),
        firstPrompt: z.string().optional(),
        gitBranch: z.string().optional(),
        cwd: z.string().optional(),
        createdAt: z.number().optional(),
    });
    export type Session = z.infer<typeof Session>;

    export const Message = z.object({
        type: z.enum(['user', 'assistant', 'system']),
        uuid: z.string(),
        session_id: z.string(),
        message: z.any(),
        parent_tool_use_id: z.string().nullable().optional(),
    });
    export type Message = z.infer<typeof Message>;

    export namespace ListSessions {
        export const Query = z.object({
            limit: z.coerce.number().min(1).max(100).default(50),
            offset: z.coerce.number().min(0).default(0),
        });
        export type Query = z.infer<typeof Query>;
    }

    export namespace GetSession {
        export const Params = z.object({
            id: z.string().uuid(),
        });
        export type Params = z.infer<typeof Params>;
    }

    export namespace DeleteSession {
        export const Params = z.object({
            id: z.string().uuid(),
        });
        export type Params = z.infer<typeof Params>;
    }

    export namespace HealthCheck {
        export const Response = z.object({
            available: z.boolean(),
            version: z.string().optional(),
            active_sessions: z.number(),
        });
    }
}
