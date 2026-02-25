// ─────────────────────────────────────────────
// Template Controller (with structured logging)
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import * as templateService from "./template.service";
import { logger } from "../../utils/logger";

export async function getTemplateHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const template = await templateService.getLatestTemplate(
            req.params.id as string,
        );
        res.json(template);
    } catch (err) {
        next(err);
    }
}

export async function updateTemplateHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { panelModes, lockedPanels, baseVersion } = req.body;
        const template = await templateService.updateTemplate(
            req.params.id as string,
            req.user!.id,
            req.membership!.role,
            { panelModes, lockedPanels, baseVersion },
        );
        logger.info(`[TEMPLATE] Updated project=${req.params.id} version=${template.layoutVersion} by=${req.user!.id}`);
        res.status(201).json(template);
    } catch (err) {
        next(err);
    }
}

export async function getHistoryHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const history = await templateService.getTemplateHistory(
            req.params.id as string,
        );
        res.json(history);
    } catch (err) {
        next(err);
    }
}
