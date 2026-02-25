// ─────────────────────────────────────────────
// Auth Controller (with structured logging)
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import { logger } from "../../utils/logger";

export async function registerHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { email, password, name } = req.body;
        const result = await authService.register({ email, password, name });
        logger.info(`[AUTH] Register success: ${result.user.email}`);
        res.status(201).json(result);
    } catch (err) {
        logger.warn(`[AUTH] Register failed: ${req.body?.email ?? "unknown"}`);
        next(err);
    }
}

export async function loginHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { email, password } = req.body;
        const result = await authService.login({ email, password });
        logger.info(`[AUTH] Login success: ${result.user.email}`);
        res.status(200).json(result);
    } catch (err) {
        logger.warn(`[AUTH] Login failed: ${req.body?.email ?? "unknown"}`);
        next(err);
    }
}
