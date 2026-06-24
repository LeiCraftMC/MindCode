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
import { router as projectsRouter } from './projects';

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


router.route('/', projectsRouter);