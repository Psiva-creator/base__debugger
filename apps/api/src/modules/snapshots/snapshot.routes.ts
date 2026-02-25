// ─────────────────────────────────────────────
// Snapshot Routes (validated)
// ─────────────────────────────────────────────

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createSnapshotSchema, visibilitySchema } from "../../utils/validation";
import {
    createSnapshotHandler,
    getSnapshotHandler,
    updateVisibilityHandler,
    forkSnapshotHandler,
    getProjectSnapshotsHandler,
} from "./snapshot.controller";

const router = Router();

// ── Project-scoped snapshot routes (require auth + membership) ──
router.post(
    "/projects/:id/snapshots",
    requireAuth,
    requireProjectRole("CREATE_SNAPSHOT"),
    validate(createSnapshotSchema),
    createSnapshotHandler,
);

router.get(
    "/projects/:id/snapshots",
    requireAuth,
    requireProjectRole("VIEW_PROJECT"),
    getProjectSnapshotsHandler,
);

// ── Standalone snapshot routes ──

// GET snapshot — optionally authenticated (public snapshots don't need auth)
router.get("/snapshots/:snapshotId", (req, _res, next) => {
    const header = req.headers.authorization;
    if (header && typeof header === "string" && header.startsWith("Bearer ")) {
        try {
            const { verifyToken } = require("../../modules/auth/auth.service");
            const payload = verifyToken(header.slice(7));
            req.user = { id: payload.userId };
        } catch {
            // Invalid token — treat as unauthenticated
        }
    }
    next();
}, getSnapshotHandler);

// Visibility toggle — owner only
router.patch(
    "/snapshots/:id/visibility",
    requireAuth,
    validate(visibilitySchema),
    updateVisibilityHandler,
);

// Fork — requires auth
router.post(
    "/snapshots/:id/fork",
    requireAuth,
    forkSnapshotHandler,
);

export default router;
