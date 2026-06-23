import { Hono } from 'hono';
import { validator } from 'hono-openapi';
import { z } from 'zod';
import { APIResponse } from '../../../../utils/api-res';
import { APIResponseSpec, APIRouteSpec } from '../../../../utils/specHelpers';
import { AuthHandler } from '../../../../utils/authHandler';
import { ClaudeSessionRunner } from '../../../../../claude/sessionRunner';
import { ClaudeModel } from './model';
import { DOCS_TAGS } from '../../docs';
import { ConfigHandler } from '../../../../../../utils/config';

export const router = new Hono().basePath('/claude');

// All routes require authentication
router.use('*', async (c, next) => {
    // @ts-ignore
    const authContext = c.get('authContext') as AuthHandler.AuthContext;
    if (authContext.type !== 'session') {
        return APIResponse.unauthorized(c, 'Your Auth Context is not a session');
    }
    await next();
});

// GET /claude/sessions — list user's claude sessions via SDK
router.get('/sessions',
    APIRouteSpec.authenticated({
        summary: 'List Claude Code sessions',
        description: "Retrieve a list of the authenticated user's Claude Code sessions from the SDK.",
        tags: [DOCS_TAGS.CLAUDE],
        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Sessions retrieved', z.object({
                sessions: z.array(ClaudeModel.Session),
            })),
            APIResponseSpec.unauthorized(),
        ),
    }),
    validator('query', ClaudeModel.ListSessions.Query),
    async (c) => {
        // @ts-ignore
        const authContext = c.get('authContext') as AuthHandler.SessionAuthContext;
        const { limit, offset } = c.req.valid('query');

        // Use per-user directory for session isolation
        const userDir = `mindcode/user-${authContext.user_id}`;

        const sdk = await import('@anthropic-ai/claude-agent-sdk');
        const sessions = await sdk.listSessions({ dir: userDir, limit, offset });

        return APIResponse.success(c, 'Sessions retrieved', { sessions });
    }
);

// GET /claude/sessions/:id — get session details with messages via SDK
router.get('/sessions/:id',
    APIRouteSpec.authenticated({
        summary: 'Get Claude Code session',
        description: 'Retrieve a specific Claude Code session and its messages from the SDK.',
        tags: [DOCS_TAGS.CLAUDE],
        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Session retrieved', z.object({
                session: ClaudeModel.Session.nullable(),
                messages: z.array(ClaudeModel.Message),
            })),
            APIResponseSpec.notFound('Session not found'),
            APIResponseSpec.unauthorized(),
        ),
    }),
    validator('param', ClaudeModel.GetSession.Params),
    async (c) => {
        // @ts-ignore
        const authContext = c.get('authContext') as AuthHandler.SessionAuthContext;
        const { id } = c.req.valid('param');

        const userDir = `mindcode/user-${authContext.user_id}`;

        const sdk = await import('@anthropic-ai/claude-agent-sdk');
        const session = await sdk.getSessionInfo(id, { dir: userDir });
        if (!session) return APIResponse.notFound(c, 'Session not found');

        const messages = await sdk.getSessionMessages(id, { dir: userDir });
        return APIResponse.success(c, 'Session retrieved', { session, messages: messages || [] });
    }
);

// DELETE /claude/sessions/:id — delete a session via SDK
router.delete('/sessions/:id',
    APIRouteSpec.authenticated({
        summary: 'Delete Claude Code session',
        description: 'Delete a specific Claude Code session via the SDK.',
        tags: [DOCS_TAGS.CLAUDE],
        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.successNoData('Session deleted'),
            APIResponseSpec.notFound('Session not found'),
            APIResponseSpec.unauthorized(),
        ),
    }),
    validator('param', ClaudeModel.DeleteSession.Params),
    async (c) => {
        // @ts-ignore
        const authContext = c.get('authContext') as AuthHandler.SessionAuthContext;
        const { id } = c.req.valid('param');

        const userDir = `mindcode/user-${authContext.user_id}`;

        const sdk = await import('@anthropic-ai/claude-agent-sdk');
        await sdk.deleteSession(id, { dir: userDir });

        return APIResponse.successNoData(c, 'Session deleted');
    }
);

// GET /claude/health — check claude binary availability
router.get('/health',
    APIRouteSpec.authenticated({
        summary: 'Claude Code health check',
        description: 'Check if the Claude Code binary is available and the WebSocket server is running.',
        tags: [DOCS_TAGS.CLAUDE],
        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Health check', ClaudeModel.HealthCheck.Response),
            APIResponseSpec.unauthorized(),
        ),
    }),
    async (c) => {
        const config = await ConfigHandler.loadConfig();
        const binaryPath = config?.MINDCODE_CLAUDE_BINARY_PATH || 'claude';
        let available = false;
        let version: string | undefined;

        try {
            const proc = Bun.spawnSync([binaryPath, '--version'], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            available = proc.exitCode === 0;
            if (available) version = proc.stdout.toString().trim();
        } catch {
            // binary not available
        }

        return APIResponse.success(c, 'Health check', {
            available,
            version,
            active_sessions: ClaudeSessionRunner.getActiveSessionCount(),
        });
    }
);
