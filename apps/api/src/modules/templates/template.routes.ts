// ─────────────────────────────────────────────
// Template Routes (validated)
// ─────────────────────────────────────────────

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { updateTemplateSchema } from "../../utils/validation";
import {
    getTemplateHandler,
    updateTemplateHandler,
    getHistoryHandler,
} from "./template.controller";

const router = Router();

// All template routes require auth
router.use(requireAuth);

// GET latest template — any project member
router.get(
    "/projects/:id/template",
    requireProjectRole("VIEW_PROJECT"),
    getTemplateHandler,
);

// POST update template — validated + EDIT_TEMPLATE
router.post(
    "/projects/:id/template",
    requireProjectRole("EDIT_TEMPLATE"),
    validate(updateTemplateSchema),
    updateTemplateHandler,
);

// GET version history — any project member
router.get(
    "/projects/:id/template/history",
    requireProjectRole("VIEW_PROJECT"),
    getHistoryHandler,
);

export default router;
