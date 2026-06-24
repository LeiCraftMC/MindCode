import { Hono } from "hono";
import { validator } from "hono-openapi";
import { DOCS_TAGS } from "../../../../docs";
import { ProjectSessionModel } from "./model";
import { ProjectModel } from "../model";
import { APIRouteSpec, APIResponseSpec } from "@@/server/lib/api/utils/specHelpers";
import { APIResponse } from "~~/server/lib/api/utils/api-res";

export const router = new Hono().basePath('/sessions');

// GET /projects/:absolute_path/sessions — list all sessions for the project
router.get('/',

    APIRouteSpec.authenticated({
        summary: 'List Project Sessions',
        description: "Retrieve all Claude Code sessions for a specific project.",
        tags: [DOCS_TAGS.CLAUDE_SESSIONS],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Sessions retrieved successfully', ProjectSessionModel.GetAll.Response),
        )
    }),

    async (c) => {
        // @ts-ignore
        const project = c.get('project') as ProjectModel.Project.WithSessions;

        return APIResponse.success(c, 'Sessions retrieved successfully', project.sessions satisfies ProjectSessionModel.GetAll.Response);
    }

);

// GET /projects/:absolute_path/sessions/:session_id — get a specific session
router.get('/:session_id',

    APIRouteSpec.authenticated({
        summary: 'Get Project Session',
        description: "Retrieve a specific Claude Code session within a project.",
        tags: [DOCS_TAGS.CLAUDE_SESSIONS],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Session retrieved successfully', ProjectSessionModel.GetBySessionId.Response),
            APIResponseSpec.notFound('Session not found'),
        )
    }),

    validator('param', ProjectSessionModel.GetBySessionId.Params),

    async (c) => {
        // @ts-ignore
        const { session_id } = c.req.valid('param') as ProjectSessionModel.GetBySessionId.Params;
        // @ts-ignore
        const project = c.get('project') as ProjectModel.Project.WithSessions;

        const session = project.sessions.find(s => s.session_id === session_id);

        if (!session) {
            return APIResponse.notFound(c, 'Session not found');
        }

        return APIResponse.success(c, 'Session retrieved successfully', session satisfies ProjectSessionModel.GetBySessionId.Response);
    }

);

// DELETE /projects/:absolute_path/sessions/:session_id — delete a session
router.delete('/:session_id',

    APIRouteSpec.authenticated({
        summary: 'Delete Project Session',
        description: "Delete a specific Claude Code session within a project.",
        tags: [DOCS_TAGS.CLAUDE_SESSIONS],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.successNoData('Session deleted successfully'),
            APIResponseSpec.notFound('Session not found'),
        )
    }),

    validator('param', ProjectSessionModel.DeleteSession.Params),

    async (c) => {
        // @ts-ignore
        const { session_id } = c.req.valid('param') as ProjectSessionModel.DeleteSession.Params;
        // @ts-ignore
        const project = c.get('project') as ProjectModel.Project.WithSessions;

        const session = project.sessions.find(s => s.session_id === session_id);

        if (!session) {
            return APIResponse.notFound(c, 'Session not found');
        }

        const sdk = await import('@anthropic-ai/claude-agent-sdk');
        await sdk.deleteSession(session_id);

        return APIResponse.successNoData(c, 'Session deleted successfully');
    }

);

// PATCH /projects/:absolute_path/sessions/:session_id — rename a session
router.patch('/:session_id',

    APIRouteSpec.authenticated({
        summary: 'Rename Project Session',
        description: "Rename a specific Claude Code session within a project.",
        tags: [DOCS_TAGS.CLAUDE_SESSIONS],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Session renamed successfully', ProjectSessionModel.GetBySessionId.Response),
            APIResponseSpec.notFound('Session not found'),
        )
    }),

    validator('param', ProjectSessionModel.RenameSession.Params),
    validator('json', ProjectSessionModel.RenameSession.Body),

    async (c) => {
        // @ts-ignore
        const { session_id } = c.req.valid('param') as ProjectSessionModel.RenameSession.Params;
        // @ts-ignore
        const { title } = c.req.valid('json') as ProjectSessionModel.RenameSession.Body;
        // @ts-ignore
        const project = c.get('project') as ProjectModel.Project.WithSessions;

        const session = project.sessions.find(s => s.session_id === session_id);

        if (!session) {
            return APIResponse.notFound(c, 'Session not found');
        }

        const sdk = await import('@anthropic-ai/claude-agent-sdk');
        await sdk.renameSession(session_id, title);

        return APIResponse.success(c, 'Session renamed successfully', {
            ...session,
            title,
        } satisfies ProjectSessionModel.GetBySessionId.Response);
    }

);
