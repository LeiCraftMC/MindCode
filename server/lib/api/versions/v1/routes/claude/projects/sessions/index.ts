import { Hono } from "hono";
import { validator } from "hono-openapi";
import { DOCS_TAGS } from "../../../../docs";
import { ProjectSessionModel } from "./model";
import { ProjectModel } from "../model";
import { APIRouteSpec, APIResponseSpec } from "../../../../../../utils/specHelpers";
import { APIResponse } from "../../../../../../utils/api-res";
import { deleteSession, getSessionInfo, getSessionMessages, renameSession } from "@anthropic-ai/claude-agent-sdk";

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

    validator('query', ProjectSessionModel.GetAll.Query),

    async (c) => {
        // @ts-ignore
        const project = c.get('project') as ProjectModel.Project.WithSessions;

        const query = c.req.valid('query');

        let sessions = project.sessions;

        if (sessions.length === 0) {
            return APIResponse.success(c, "Sessions retrieved successfully", sessions satisfies ProjectSessionModel.GetAll.Response);
        }

        if (query.order === "newest") {
            sessions = sessions.sort((a, b) => b.last_modified - a.last_modified);
        } else if (query.order === "oldest") {
            sessions = sessions.sort((a, b) => a.last_modified - b.last_modified);
        }

        if (query.searchString) {
            const searchLower = query.searchString.toLowerCase();
            sessions = sessions.filter(session => session.title.toLowerCase().includes(searchLower));
        }

        if (query.limit) {
            if (query.offset) {
                sessions = sessions.slice(query.offset, query.offset + query.limit);
            } else {
                sessions = sessions.slice(0, query.limit);
            }
        }

        return APIResponse.success(c, "Sessions retrieved successfully", sessions satisfies ProjectSessionModel.GetAll.Response);
        
    }

);

router.use('/:session_id/*',

    validator('param', ProjectSessionModel.GetBySessionId.Params),

    async (c, next) => {
        // @ts-ignore
        const { session_id } = c.req.valid('param') as ProjectSessionModel.GetBySessionId.Params;
        // @ts-ignore
        const project = c.get('project') as ProjectModel.Project.WithSessions;

        const session = project.sessions.find(s => s.session_id === session_id);

        if (!session) {
            return APIResponse.notFound(c, 'Session not found');
        }

        // @ts-ignore
        c.set('session', session satisfies ProjectSessionModel.Session);

        await next();
    }
)


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

    async (c) => {
        // @ts-ignore
        const session = c.get('session') as ProjectSessionModel.Session;

        return APIResponse.success(c, 'Session retrieved successfully', session satisfies ProjectSessionModel.GetBySessionId.Response);
    }

);

router.get('/:session_id/messages',

    APIRouteSpec.authenticated({
        summary: 'Get Project Session Messages',
        description: "Retrieve messages for a specific Claude Code session within a project.",
        tags: [DOCS_TAGS.CLAUDE_SESSIONS],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Session messages retrieved successfully', ProjectSessionModel.GetSessionMessages.Response),
            APIResponseSpec.notFound('Session not found'),
        )
    }),

    async (c) => {
        // @ts-ignore
        const project = c.get('project') as ProjectModel.Project.WithSessions;
        // @ts-ignore
        const session = c.get('session') as ProjectSessionModel.Session;

        const sessionMessages_raw = await getSessionMessages(session.session_id, {
            dir: project.absolute_path
        });

        return APIResponse.success(c, 'Session messages retrieved successfully', sessionMessages_raw as ProjectSessionModel.GetSessionMessages.Response);
    }

);

// PUT /projects/:absolute_path/sessions/:session_id — update a session (rename)
router.put('/:session_id',

    APIRouteSpec.authenticated({
        summary: 'Rename Project Session',
        description: "Rename a specific Claude Code session within a project.",
        tags: [DOCS_TAGS.CLAUDE_SESSIONS],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Session renamed successfully', ProjectSessionModel.GetBySessionId.Response),
            APIResponseSpec.notFound('Session not found'),
        )
    }),

    validator('json', ProjectSessionModel.UpdateSession.Body),

    async (c) => {

        // @ts-ignore
        const session = c.get('session') as ProjectSessionModel.Session;

        const { title } = c.req.valid('json') as ProjectSessionModel.UpdateSession.Body;

        await renameSession(session.session_id, title);

        const updatedSession_raw = await getSessionInfo(session.session_id);

        if (!updatedSession_raw) {
            return APIResponse.notFound(c, 'Internal error: Session not found after renaming');
        }
        
        const updatedSession = {
            session_id: updatedSession_raw.sessionId,
            title: updatedSession_raw.summary,
            last_modified: updatedSession_raw.lastModified,
            git_branch: updatedSession_raw.gitBranch,
            created_at: updatedSession_raw.createdAt,
        } satisfies ProjectSessionModel.Session;

        return APIResponse.success(c, 'Session renamed successfully', updatedSession satisfies ProjectSessionModel.GetBySessionId.Response);
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

    async (c) => {
        // @ts-ignore
        const session = c.get('session') as ProjectSessionModel.Session;

        await deleteSession(session.session_id);

        return APIResponse.successNoData(c, 'Session deleted successfully');
    }

);

