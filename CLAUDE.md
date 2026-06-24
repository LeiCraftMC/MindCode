# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

MindCode is a Nuxt 4 full-stack web application that wraps a browser UI around the Anthropic Claude Code CLI / Agent SDK. The backend runs under Bun/Nitro and exposes a Hono REST API (OpenAPI documented) plus a WebSocket endpoint that proxies to the Claude Agent SDK. User accounts, sessions and metadata are stored in SQLite via Drizzle ORM.

Runtime: Bun. Package manager: bun. Port: 13338 (dev and production default).

## Common commands

- `bun install` – install dependencies (also runs `nuxt prepare` via `postinstall`).
- `bun run dev` – start the Nuxt dev server on port 13338.
- `bun run build` – build the production Nuxt bundle to `.output/`.
- `bun run start` – start the production server (assumes `.output/` already built, uses Bun). Use `PORT=13338`.
- `bun run typecheck` – run `nuxt typecheck`, then project `tsc` over `tsconfig/tsconfig.typecheck.json`.
- `bun test` – run all Bun test suites.
- `bun test tests/utils.test.ts` – run a single test file.
- `bun run db:generate` – run the Drizzle migrations generator (also runs `scripts/db-utils` to ensure `./data` exists).
- `bun run db:migrate` – apply Drizzle migrations.
- `bun run api-client:generate` – regenerate the frontend TypeScript/OpenAPI client from the live API spec.

Most scripts expect a `.env` file with the variables shown in `example.env` (values are not secrets, just config): `MINDCODE_LOG_LEVEL`, `MINDCODE_HOST`, `MINDCODE_PORT`, `MINDCODE_DB_PATH`, `MINDCODE_DB_AUTO_MIGRATE`, `MINDCODE_CONFIG_BASE_DIR`, `MINDCODE_APP_URL`. When adding a new environment variable, also register it in `server/utils/config.ts` so it becomes part of `ParsedConfig`.

## Architecture

### Server

The server has two entry paths:

1. **Standalone API process** – `server/index.ts` runs `Main.main()`, which loads config, initializes `DB`, configures `ClaudeSessionRunner`, builds the Hono `API`, and starts a plain Bun HTTP server. Useful for headless API-only execution.
2. **Nuxt/Nitro embedded mode** – the production Nuxt server builds through Nitro and serves API calls via `server/routes/api/[...].ts`, which wraps `API.getApp()` in a fresh Hono instance and adapts Nitro/h3 requests into `Request` objects. WebSockets are served via `server/routes/ws/claude.ts`.

On startup, `server/plugins/startup.ts` calls the same initialization sequence (`ConfigHandler.loadConfig`, `DB.init`, `ClaudeSessionRunner.configure`, `API.init`). The API plugin therefore works for both standalone and embedded contexts.

The Hono API is versioned. `server/lib/api/index.ts` holds the `API` class, which registers version routers derived from `APIVersionRouter` (`server/lib/api/utils/apiVersionRouter.ts`). Currently only `APIv1Router` exists (`server/lib/api/versions/v1/index.ts`). V1 mounts sub-routers under `/v1/{auth,account,admin,users,claude}`. Every version router is registered with an OpenAPI spec endpoint at `/docs/v{n}/openapi` and a Scalar docs UI at `/docs/v{n}` unless `MINDCODE_API_DISABLE_DOCS` is true.

`server/lib/api/utils/authHandler.ts` provides session-bearer auth. Tokens have the form `mc_sess_<id>:<base>`. `AuthMiddlewareV1` (`server/lib/api/versions/v1/middleware/auth.ts`) parses the `Authorization` header and attaches an `authContext` (session or unauthenticated) to the Hono context. Routes gate themselves by checking `authContext.type` and `user_role`.

`server/lib/api/utils/api-res.ts` and `server/lib/api/utils/specHelpers.ts` standardize JSON envelopes (`{ success, code, message, data }`) and OpenAPI response descriptions. New routes should use `APIRouteSpec.authenticated` / `unauthenticated` plus `APIResponseSpec.describeBasic` / `describeWithWrongInputs` and return responses through `APIResponse` helpers.

`server/db/index.ts` manages the SQLite connection and migration runner. Schema lives in `server/db/schema.ts`; use `DB.Tables.<name>` rather than importing raw schema exports (the direct exports are marked deprecated). `DB.init` also bootstraps a default `admin` user when the `users` table is empty and writes a one-time password-reset link to `MINDCODE_CONFIG_BASE_DIR/initial_admin_password_reset_token.txt`.

### Claude Code integration

`server/lib/claude/sessionRunner.ts` implements `ClaudeSessionRunner`, a static state machine that manages WebSocket clients authenticated through the same session tokens as the REST API. It drives the `@anthropic-ai/claude-agent-sdk` `query()` API, forwards events (deltas, tool_use summaries, results, system events) back to the browser, and supports `start`, `message`, `cancel` and `auth` message types. Sessions are isolated per user via `mindcode/user-{userId}` directories and persisted as JSONL files by the SDK itself. The frontend WebSocket lives in `app/composables/useClaudeWebSocket.ts` and the main UI page in `app/pages/(dashboard)/code/index.vue`.

### Frontend

`app/` is a Nuxt/Vue 3 app using `@nuxt/ui` v4. Global layouts: `app/layouts/auth.vue` for auth pages, `app/layouts/dashboard.vue` for the main app. The dashboard layout has a sidebar routing to `/` (dashboard), `/code` (Claude Code), `/admin/users` (admin only), and `/settings/*`.

API consumption is centralized in `app/composables/useAPI.ts`. It configures the generated `@hey-api` client (`app/api-client/`) at runtime with the bearer token stored in the `mindcode_session_token` cookie, and redirects to `/auth/login` when the server returns 401. Generated SDK files are the output of `bun run api-client:generate`, which fetches the OpenAPI spec from `localhost:13340/docs/v1/openapi`, runs `openapi-ts`, and then applies TypeScript patches via `scripts/patch-api-client.ts`. Do not hand-edit generated `*.gen.ts` files; regenerate instead.

Global route middleware (`app/middleware/auth.global.ts`) enforces authentication for non-`/auth` routes and admin role checks for `/admin`. `app/middleware/rewrites.global.ts` strips trailing slashes.

State helpers:
- `app/utils/abstractStore.ts` gives reactive server-safe stores built on Nuxt `useState`.
- `app/composables/stores/useUserStore.ts` fetches `/account` for the current user.
- `app/composables/stores/useClaudeSessionStore.ts` groups Claude sessions by project/cwd and persists custom project paths in `localStorage`.

### API client generation workflow

`scripts/api-client-generate.ts` is a standalone script that starts the Hono API on `13340`, runs `bunx openapi-ts` (using `openapi-ts.config.ts`), then runs `scripts/patch-api-client.ts`. The patch fixes two known type issues in `@hey-api/openapi-ts` v0.98.2 output for the Nuxt client. After changing route specs or adding endpoints, rerun `bun run api-client:generate`.

### Database migrations

Migrations are generated into `drizzle/` by `drizzle-kit` and applied automatically when `MINDCODE_DB_AUTO_MIGRATE=true`. For local dev the DB defaults to `./data/db.sqlite`. The schema file is `server/db/schema.ts`. Add or change columns there, then run `bun run db:generate` and `bun run db:migrate`.

### Testing

Tests live in `tests/` and use `bun:test`. `bunfig.toml` preloads `tests/helpers/preload.ts` for every test run. `preload.ts` creates an isolated temp directory, sets test env vars, initializes `DB`, and tears down after all tests. Tests directly call `API.getApp().request(...)` or use helpers in `tests/helpers/api.ts` and `tests/helpers/seed.ts`.

To run a single test file: `bun test <path>`.

### CI

`.gitlab-ci.yml` includes `.gitlab/ci/testing.yml`, which runs `bun run typecheck` and `bun test` inside the `oven/bun` image. There is no lint step in CI at the moment.

## Notes for future edits

- Do not hand-edit `app/api-client/*.gen.ts`. Regenerate with `bun run api-client:generate`.
- When adding env vars, register them in `server/utils/config.ts` via `ConfigHandler.schema.add(...)` or they will not be loaded into `ParsedConfig`.
- Keep route responses inside the `APIResponse` envelope so they match the generated client types.
- Password hashing uses `Bun.password` (bcrypt). New auth paths should reuse `AuthHandler` / `SessionHandler` rather than inventing token logic.
- WebSocket auth relies on the same `mc_sess_*` token used by the REST API; the frontend sends it in the `auth` message after connection.
