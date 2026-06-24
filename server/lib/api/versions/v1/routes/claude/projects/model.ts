import { z } from "zod";
import { ProjectSessionModel } from "./sessions/model";
import { ApiHelperModels } from "../../../../../utils/shared-models/api-helper-models";


export namespace ProjectModel.Project {

    export const Exists = z.object({
        exists: z.literal(true),
        name: z.string(),
        absolute_path: z.string(),
        last_used: z.number().int()
    });
    export type Exists = z.infer<typeof Exists>;

    export const NotExists = z.object({
        exists: z.literal(false),
        name: z.string(),
        absolute_path: z.string(),
        last_used: z.undefined()
    });
    export type NotExists = z.infer<typeof NotExists>;

    export const ExistingWithSessions = Exists.extend({
        sessions: z.array(ProjectSessionModel.Session)
    });
    export type ExistingWithSessions = z.infer<typeof ExistingWithSessions>;

    export const NotExistsWithSessions = NotExists.extend({
        sessions: z.array(ProjectSessionModel.Session)
    });
    export type NotExistsWithSessions = z.infer<typeof NotExistsWithSessions>;

    export type WithoutSessions = Omit<Exists | NotExists, 'exists'> & { exists: boolean };
    export type WithSessions = Omit<ExistingWithSessions | NotExistsWithSessions, 'exists'> & { exists: boolean };

    
    export const ExistingProjectsSorted = z.record(z.string().meta({ title: "Project absolute path" }), Exists);
    export type ExistingProjectsSorted = {
        [absolute_path: string]: Exists;
    };

}

export namespace ProjectModel.GetProjectByPath {

    export const Params = z.object({
        absolute_path: z.codec(
            z.string().meta({ title: "URI-encoded project absolute path" }),
            z.string().meta({ title: "Decoded project absolute path" }),
            {
                encode: (val) => encodeURIComponent(val),
                decode: (val) => decodeURIComponent(val)
            }
        )
    });
    export type Params = z.infer<typeof Params>;


    export const Query = z.object({
        with_sessions: z.coerce.boolean().optional().default(false).meta({ title: "Whether to include sessions in the response" })
    });


    export const Response = z.union([
        ProjectModel.Project.Exists,
        ProjectModel.Project.NotExists,

        ProjectModel.Project.ExistingWithSessions,
        ProjectModel.Project.NotExistsWithSessions
    ]);
    export type Response = z.infer<typeof Response>;
}


export namespace ProjectModel.GetAll {

    export const Response = z.array(ProjectModel.Project.Exists);
    export type Response = z.infer<typeof Response>;

    export const Query = ApiHelperModels.ListAll.QueryWithSearch;

}

