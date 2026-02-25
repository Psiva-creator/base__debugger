// ─────────────────────────────────────────────
// Environment Configuration
// ─────────────────────────────────────────────
// Loads and validates environment variables.
// Fails fast if required vars are missing.
// ─────────────────────────────────────────────

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── Required Environment Variables ──

const REQUIRED_VARS = ["PORT", "DATABASE_URL", "JWT_SECRET"] as const;

function validateEnv(): void {
    const missing: string[] = [];
    for (const key of REQUIRED_VARS) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        console.error(
            `❌ Missing required environment variables:\n${missing.map((v) => `   - ${v}`).join("\n")}`
        );
        process.exit(1);
    }
}

validateEnv();

// ── Typed Config ──

export const config = {
    port: parseInt(process.env.PORT!, 10),
    databaseUrl: process.env.DATABASE_URL!,
    jwtSecret: process.env.JWT_SECRET!,
    nodeEnv: (process.env.NODE_ENV || "development") as "development" | "production" | "test",
    isDev: (process.env.NODE_ENV || "development") === "development",
    isProd: process.env.NODE_ENV === "production",
    corsOrigins: process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()) || [],
} as const;
