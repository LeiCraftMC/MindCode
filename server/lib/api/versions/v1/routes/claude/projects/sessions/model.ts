import { z } from "zod";

export namespace ProjectSessionModel {

    export const Session = z.object({
        session_id: z.string(),
        title: z.string(),
        last_modified: z.number().int(),
        git_branch: z.string().optional(),
        created_at: z.number().int().optional(),
    });

    export type Session = z.infer<typeof Session>;

}

export namespace ProjectSessionModel.GetAll {

    export const Response = z.array(ProjectSessionModel.Session);
    export type Response = z.infer<typeof Response>;

}

export namespace ProjectSessionModel.GetBySessionId {

    export const Params = z.object({
        session_id: z.string()
    });

    export type Params = z.infer<typeof Params>;

    export const Response = ProjectSessionModel.Session;
    export type Response = z.infer<typeof Response>;

}

export namespace ProjectSessionModel.DeleteSession {

    export const Params = z.object({
        session_id: z.string()
    });

    export type Params = z.infer<typeof Params>;

}

export namespace ProjectSessionModel.RenameSession {

    export const Params = z.object({
        session_id: z.string()
    });

    export type Params = z.infer<typeof Params>;

    export const Body = z.object({
        title: z.string().min(1).max(255)
    });

    export type Body = z.infer<typeof Body>;

}