import { Hono } from "hono";
import { DOCS_TAGS } from "../../../docs";
import { ProjectModel } from "./model";
import { APIRouteSpec, APIResponseSpec } from "../../../../../utils/specHelpers";
import { listSessions } from "@anthropic-ai/claude-agent-sdk";
import { APIResponse } from "../../../../../utils/api-res";
import { validator } from "hono-openapi";
import { router as sessionsRouter } from "./sessions";
import { ProjectSessionModel } from "./sessions/model";

function getProjectNameFromPath(absolute_path: string): string {
    const parts = absolute_path.split('/');
    return parts[parts.length - 1] || absolute_path;
}

async function getExistingProjects() {

    const all_claude_sessions = await listSessions();

    const existing_projects: ProjectModel.Project.ExistingProjectsSorted = {};

    for (const session of all_claude_sessions) {

        const project_path = session.cwd;

        if (!project_path) {
            continue;
        }

        if (!existing_projects[project_path]) {
            existing_projects[project_path] = {
                exists: true,
                name: getProjectNameFromPath(project_path),
                absolute_path: project_path,
                last_used: session.lastModified,
            };
        } else {
            // Update last_used if this session is more recent
            if (session.lastModified > existing_projects[project_path].last_used) {
                existing_projects[project_path].last_used = session.lastModified;
            }
        }
    }

    return existing_projects;
}

async function getProjectWithSessions(absolute_path: string) {

    const all_claude_sessions = await listSessions();

    const project_with_sessions: ProjectModel.Project.NotExistsWithSessions | ProjectModel.Project.ExistingWithSessions = {
        exists: false,
        name: getProjectNameFromPath(absolute_path),
        absolute_path: absolute_path,
        last_used: undefined,
        sessions: []
    };

    for (const session of all_claude_sessions) {

        const project_path = session.cwd;

        if (!project_path || project_path !== absolute_path) {
            continue;
        }

        if (project_with_sessions.exists === false) {
            (project_with_sessions as any as ProjectModel.Project.ExistingWithSessions).exists = true;
            (project_with_sessions as any as ProjectModel.Project.ExistingWithSessions).last_used = session.lastModified;
        } else {
            // Update last_used if this session is more recent
            if (session.lastModified > (project_with_sessions as any as ProjectModel.Project.ExistingWithSessions).last_used) {
                (project_with_sessions as any as ProjectModel.Project.ExistingWithSessions).last_used = session.lastModified;
            }
        }

        project_with_sessions.sessions.push({
            session_id: session.sessionId,
            title: session.summary,
            last_modified: session.lastModified,
            created_at: session.createdAt,
            git_branch: session.gitBranch,
        } satisfies ProjectSessionModel.Session);
    }

    return project_with_sessions as ProjectModel.Project.ExistingWithSessions | ProjectModel.Project.NotExistsWithSessions;
}

export const router = new Hono().basePath('/projects');


router.get('/',

    APIRouteSpec.authenticated({
        summary: 'List All Projects',
        description: "Retrieve a list of all existing projects.",
        tags: [DOCS_TAGS.CLAUDE_PROJECTS],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Projects retrieved successfully', ProjectModel.GetAll.Response),
        )
    }),

    validator('query', ProjectModel.GetAll.Query),

    async (c) => {

        const query = c.req.valid('query')

        let existing_projects = await getExistingProjects();

        if (query.order === "newest") {
            existing_projects = Object.values(existing_projects).sort((a, b) => b.last_used - a.last_used).reduce((acc, project) => {
                acc[project.absolute_path] = project;
                return acc;
            }, {} as ProjectModel.Project.ExistingProjectsSorted);
        } else if (query.order === "oldest") {
            existing_projects = Object.values(existing_projects).sort((a, b) => a.last_used - b.last_used).reduce((acc, project) => {
                acc[project.absolute_path] = project;
                return acc;
            }, {} as ProjectModel.Project.ExistingProjectsSorted);
        }

        if (query.searchString) {
            const searchLower = query.searchString.toLowerCase();
            existing_projects = Object.values(existing_projects).filter(project => project.name.toLowerCase().includes(searchLower)).reduce((acc, project) => {
                acc[project.absolute_path] = project;
                return acc;
            }, {} as ProjectModel.Project.ExistingProjectsSorted);
        }

        if (query.limit) {
            if (query.offset) {
                existing_projects = Object.values(existing_projects).slice(query.offset, query.offset + query.limit).reduce((acc, project) => {
                    acc[project.absolute_path] = project;
                    return acc;
                }, {} as ProjectModel.Project.ExistingProjectsSorted);
            } else {
                existing_projects = Object.values(existing_projects).slice(0, query.limit).reduce((acc, project) => {
                    acc[project.absolute_path] = project;
                    return acc;
                }, {} as ProjectModel.Project.ExistingProjectsSorted);
            }
        }

        return APIResponse.success(c, 'Projects retrieved successfully', Object.values(existing_projects) satisfies ProjectModel.GetAll.Response);

    }

);

router.use('/:absolute_path/*',

    validator('param', ProjectModel.GetProjectByPath.Params),

    async (c, next) => {
        // @ts-ignore
        const { absolute_path } = c.req.valid('param') as ProjectModel.GetProjectByPath.Params;

        const project_with_sessions = await getProjectWithSessions(absolute_path)

        // @ts-ignore
        c.set('project', 
            project_with_sessions satisfies ProjectModel.Project.WithSessions
        );

        await next();

    }
)


router.get('/:absolute_path',

    APIRouteSpec.authenticated({
        summary: 'Get Project by its Absolute Path',
        description: "Retrieve a specific project by its absolute path.",
        tags: [DOCS_TAGS.CLAUDE_PROJECTS],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success('Project retrieved successfully', ProjectModel.GetProjectByPath.Response),
        )
    }),

    validator('query', ProjectModel.GetProjectByPath.Query),

    async (c) => {

        // @ts-ignore
        const project = c.get('project') as ProjectModel.Project.WithSessions;

        if (!c.req.valid('query').with_sessions) {
            
            const result: ProjectModel.Project.WithoutSessions = {
                exists: project.exists,
                name: project.name,
                absolute_path: project.absolute_path,
                last_used: project.last_used
            };

            return APIResponse.success(c, 'Project retrieved successfully', result);
        }

        // order by newest session first
        project.sessions.sort((a, b) => b.last_modified - a.last_modified);

        return APIResponse.success(c, 'Project retrieved successfully', project as ProjectModel.GetProjectByPath.Response);

    }
);

router.route('/:absolute_path', sessionsRouter);