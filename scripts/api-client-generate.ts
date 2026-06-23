/**
 * Standalone script that generates the OpenAPI TypeScript client.
 *
 * 1. Starts the API server so the OpenAPI spec is live at localhost:13338
 * 2. Runs openapi-ts (reads openapi-ts.config.ts → fetches spec → generates app/api-client/)
 * 3. Patches known TypeScript issues in the generated output
 * 4. Stops the API server (always, even on failure)
 */
import { API } from "../server/lib/api";

const PORT = 13338;
const HOST = "localhost";

await API.init();
await API.start(PORT, HOST);

try {
    console.log(`[api-client-generate] Server running at ${HOST}:${PORT}, generating client…`);

    await Bun.$`bunx openapi-ts`;
    console.log("[api-client-generate] openapi-ts succeeded, patching generated client…");

    await Bun.$`bun scripts/patch-api-client.ts`;
    console.log("[api-client-generate] Patch applied successfully.");
} finally {
    await API.stop();
    console.log("[api-client-generate] Server stopped.");
}
