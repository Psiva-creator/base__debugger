// ─────────────────────────────────────────────
// Snapshot Controller (with structured logging)
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import * as snapshotService from "./snapshot.service";
import { logger } from "../../utils/logger";

export async function createSnapshotHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { microIndex, executionHash } = req.body;
        const snapshot = await snapshotService.createSnapshot(
            req.params.id as string,
            req.user!.id,
            { microIndex, executionHash },
        );
        logger.info(`[SNAPSHOT] Created id=${snapshot.id} project=${req.params.id} by=${req.user!.id}`);
        res.status(201).json(snapshot);
    } catch (err) {
        next(err);
    }
}

export async function getSnapshotHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user?.id ?? null;
        const snapshot = await snapshotService.getSnapshot(
            req.params.snapshotId as string,
            userId,
        );
        res.json(snapshot);
    } catch (err) {
        next(err);
    }
}

export async function updateVisibilityHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { visibility } = req.body;
        const snapshot = await snapshotService.updateVisibility(
            req.params.id as string,
            req.user!.id,
            visibility,
        );
        logger.info(`[SNAPSHOT] Visibility changed id=${snapshot.id} to=${visibility} by=${req.user!.id}`);
        res.json(snapshot);
    } catch (err) {
        next(err);
    }
}

export async function forkSnapshotHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await snapshotService.forkSnapshot(
            req.params.id as string,
            req.user!.id,
        );
        logger.info(`[FORK] Forked snapshot=${req.params.id} → project=${result.projectId} by=${req.user!.id}`);
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
}

export async function getProjectSnapshotsHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const snapshots = await snapshotService.getProjectSnapshots(
            req.params.id as string,
        );
        res.json(snapshots);
    } catch (err) {
        next(err);
    }
}
