// ─────────────────────────────────────────────
// Rate Limiting Middleware
// ─────────────────────────────────────────────
// Global: 100 req / 15 min per IP
// Auth:   10 req / 15 min per IP (brute-force protection)
// ─────────────────────────────────────────────

import rateLimit from "express-rate-limit";

/** Global rate limiter — 100 requests per 15-minute window */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests, please try again later",
        },
    },
});

/** Strict limiter for auth endpoints — 10 attempts per 15 minutes */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            code: "AUTH_RATE_LIMIT_EXCEEDED",
            message: "Too many authentication attempts, please try again later",
        },
    },
});
