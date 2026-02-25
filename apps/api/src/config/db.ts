// ─────────────────────────────────────────────
// PostgreSQL Connection Pool
// ─────────────────────────────────────────────
// Creates a pg Pool from DATABASE_URL.
// Enables SSL in production.
// Fails process on connection error.
// ─────────────────────────────────────────────

import { Pool } from "pg";
import { config } from "./env";
import { logger } from "../utils/logger";

export const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.isProd ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// ── Connection Lifecycle ──

pool.on("connect", () => {
    logger.info("📦 PostgreSQL client connected");
});

pool.on("error", (err) => {
    logger.error("❌ PostgreSQL pool error — shutting down", err);
    process.exit(1);
});

/** Test the connection and log success / fail fast */
export async function connectDB(): Promise<void> {
    try {
        const client = await pool.connect();
        const result = await client.query("SELECT NOW()");
        client.release();
        logger.info(`✅ PostgreSQL connected at ${result.rows[0]?.now}`);
    } catch (err) {
        logger.error("❌ Failed to connect to PostgreSQL — shutting down", err);
        process.exit(1);
    }
}
