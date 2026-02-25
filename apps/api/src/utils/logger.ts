// ─────────────────────────────────────────────
// Logger Utility
// ─────────────────────────────────────────────
// Structured logger with timestamps.
// Filters sensitive data (passwords, JWTs).
// Silences debug in production.
// ─────────────────────────────────────────────

const SENSITIVE_PATTERNS = /password|secret|token|authorization|jwt|bearer/i;

function timestamp(): string {
    return new Date().toISOString();
}

/** Redact sensitive keys from objects before logging */
function sanitize(args: unknown[]): unknown[] {
    return args.map((arg) => {
        if (typeof arg === "string" && SENSITIVE_PATTERNS.test(arg)) {
            return "[REDACTED]";
        }
        if (arg && typeof arg === "object" && !Array.isArray(arg)) {
            const sanitized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(arg as Record<string, unknown>)) {
                if (SENSITIVE_PATTERNS.test(key)) {
                    sanitized[key] = "[REDACTED]";
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }
        return arg;
    });
}

export const logger = {
    info(message: string, ...args: unknown[]): void {
        console.log(`[${timestamp()}] INFO  ${message}`, ...sanitize(args));
    },

    warn(message: string, ...args: unknown[]): void {
        console.warn(`[${timestamp()}] WARN  ${message}`, ...sanitize(args));
    },

    error(message: string, ...args: unknown[]): void {
        console.error(`[${timestamp()}] ERROR ${message}`, ...sanitize(args));
    },

    debug(message: string, ...args: unknown[]): void {
        if (process.env.NODE_ENV !== "production") {
            console.debug(`[${timestamp()}] DEBUG ${message}`, ...sanitize(args));
        }
    },
};
