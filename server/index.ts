import { API } from "./lib/api";
import { DB } from "./db";
import { ConfigHandler } from "./utils/config";
import { Logger } from "./utils/logger";

export class Main {

    static async main() {

        process.once("SIGINT", (type) => Main.gracefulShutdown(type, 0));
        process.once("SIGTERM", (type) => Main.gracefulShutdown(type, 0));

        process.once("uncaughtException", Main.handleUncaughtException);
        process.once("unhandledRejection", Main.handleUnhandledRejection);

        const config = await ConfigHandler.loadConfig();

        Logger.setLogLevel(config.MINDCODE_LOG_LEVEL ?? "info");

        await DB.init(
            config.MINDCODE_DB_PATH ?? "./data/db.sqlite",
            config.MINDCODE_DB_AUTO_MIGRATE,
            config.MINDCODE_CONFIG_BASE_DIR ?? "./config"
        );

        await API.init(config.MINDCODE_API_DISABLE_DOCS === true);

        await API.start(
            parseInt(config.MINDCODE_PORT || "13338") ?? 13338,
            config.MINDCODE_HOST ?? "localhost"
        );

    }

    private static async gracefulShutdown(type: NodeJS.Signals, code: number) {
        try {
            Logger.log(`Received ${type}, shutting down...`);

            await API.stop();
            await DB.close();

            Logger.log("Shutdown complete, exiting.");
            process.exit(code);
        } catch {
            Logger.critical("Error during shutdown, forcing exit");
            Main.forceShutdown();
        }
    }

    private static forceShutdown() {
        process.once("SIGTERM", ()=>{});
        process.exit(1);
    }

    private static async handleUncaughtException(error: Error) {
        Logger.critical(`Uncaught Exception:\n${Error.isError(error) ? error.stack ? error.stack : error.message : error}`);
        Main.gracefulShutdown("SIGTERM", 1);
    }

    private static async handleUnhandledRejection(reason: any) {
        if (Error.isError(reason)) {
            // reason is an error
            return Main.handleUncaughtException(reason);
        }
        Logger.critical(`Unhandled Rejection:\n${reason}`);
        Main.gracefulShutdown("SIGTERM", 1);
    }

}

// Standalone entry point removed — the Hono app is now initialized by
// server/plugins/hono.ts and served via server/routes/api/[...].ts within Nitro.

if (import.meta.main) {
    await Main.main();
}