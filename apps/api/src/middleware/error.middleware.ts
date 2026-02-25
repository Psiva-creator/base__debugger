// ─────────────────────────────────────────────
// Global Error Middleware
// ─────────────────────────────────────────────
// Catches all unhandled errors, logs them,
// and returns structured JSON response.
// - Hides stack traces in production
// - Never exposes DB errors
// - Standard error shape: { error: { code, message } }
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { config } from "../config/env";

export interface AppError extends Error {
    statusCode?: number;
    code?: string;
}

export function errorMiddleware(
    err: AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    const statusCode = err.statusCode || 500;

    // Sanitize message in production — never expose internals
    let message: string;
    let code: string;

    if (statusCode >= 500 && config.isProd) {
        message = "Internal server error";
        code = "INTERNAL_ERROR";
    } else {
        message = err.message || "Internal server error";
        code = err.code || statusCodeToCode(statusCode);
    }

    logger.error(`[${statusCode}] ${message}`, config.isDev ? err.stack : "");

    res.status(statusCode).json({
        error: {
            code,
            message,
            ...(config.isDev && { stack: err.stack }),
        },
    });
}

function statusCodeToCode(status: number): string {
    switch (status) {
        case 400: return "BAD_REQUEST";
        case 401: return "UNAUTHORIZED";
        case 403: return "FORBIDDEN";
        case 404: return "NOT_FOUND";
        case 409: return "CONFLICT";
        case 429: return "RATE_LIMITED";
        default: return "INTERNAL_ERROR";
    }
}
