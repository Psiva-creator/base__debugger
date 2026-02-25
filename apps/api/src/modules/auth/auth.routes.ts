// ─────────────────────────────────────────────
// Auth Routes (rate-limited + validated)
// ─────────────────────────────────────────────

import { Router } from "express";
import { authLimiter } from "../../middleware/rate-limit.middleware";
import { validate } from "../../middleware/validate.middleware";
import { registerSchema, loginSchema } from "../../utils/validation";
import { registerHandler, loginHandler } from "./auth.controller";

const router = Router();

router.post("/auth/register", authLimiter, validate(registerSchema), registerHandler);
router.post("/auth/login", authLimiter, validate(loginSchema), loginHandler);

export default router;
