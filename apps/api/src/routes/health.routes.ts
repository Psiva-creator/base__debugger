// ─────────────────────────────────────────────
// Health Route
// ─────────────────────────────────────────────
// GET /health — Returns service status, uptime,
// and timestamp.
// ─────────────────────────────────────────────

import { Router, Request, Response } from "express";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now(),
    });
});

export default router;
