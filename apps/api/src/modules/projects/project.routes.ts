// ─────────────────────────────────────────────
// Project Routes (validated)
// ─────────────────────────────────────────────

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createProjectSchema, addMemberSchema } from "../../utils/validation";
import {
    createProjectHandler,
    getProjectsHandler,
    getProjectHandler,
    addMemberHandler,
    getMembersHandler,
} from "./project.controller";

const router = Router();

// All project routes require auth
router.use(requireAuth);

// ── Project CRUD ──
router.post("/projects", validate(createProjectSchema), createProjectHandler);
router.get("/projects", getProjectsHandler);
router.get("/projects/:id", requireProjectRole("VIEW_PROJECT"), getProjectHandler);

// ── Membership Management ──
router.post("/projects/:id/members", requireProjectRole("ASSIGN_ROLE"), validate(addMemberSchema), addMemberHandler);
router.get("/projects/:id/members", requireProjectRole("VIEW_MEMBERS"), getMembersHandler);

export default router;
