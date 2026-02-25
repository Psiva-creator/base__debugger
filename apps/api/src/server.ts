// ─────────────────────────────────────────────
// Server Bootstrap
// ─────────────────────────────────────────────
// Entry point. Connects to DB, starts Express.
// ─────────────────────────────────────────────

import app from "./app";
import { config } from "./config/env";
import { connectDB } from "./config/db";
import { logger } from "./utils/logger";

async function bootstrap(): Promise<void> {
    // ── Connect to PostgreSQL ──
    await connectDB();

    // ── Start HTTP Server ──
    app.listen(config.port, () => {
        logger.info(`🚀 ChronoVM API running on port ${config.port}`);
        logger.info(`   Environment: ${config.nodeEnv}`);
    });
}

bootstrap().catch((err) => {
    logger.error("❌ Failed to bootstrap server", err);
    process.exit(1);
});
