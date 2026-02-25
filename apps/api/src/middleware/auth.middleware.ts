// ─────────────────────────────────────────────
// Auth Middleware — requireAuth
// ─────────────────────────────────────────────
// Verifies Bearer token, decodes JWT payload,
// and attaches req.user = { id }.
// Rejects invalid or expired tokens with 401.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../modules/auth/auth.service";

export function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
        return;
    }

    const token = header.slice(7); // Remove "Bearer "

    try {
        const payload = verifyToken(token);
        req.user = { id: payload.userId };
        next();
    } catch (err: any) {
        const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
        const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
        res.status(401).json({ error: { code, message } });
    }
}
