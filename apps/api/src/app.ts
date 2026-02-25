// ─────────────────────────────────────────────
// Express Application
// ─────────────────────────────────────────────
// Production-hardened Express configuration.
// ─────────────────────────────────────────────

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config/env";
import { globalLimiter } from "./middleware/rate-limit.middleware";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./modules/auth/auth.routes";
import projectRoutes from "./modules/projects/project.routes";
import templateRoutes from "./modules/templates/template.routes";
import snapshotRoutes from "./modules/snapshots/snapshot.routes";
import { requireAuth } from "./middleware/auth.middleware";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

// ── Security Headers ──
app.use(helmet());
app.disable("x-powered-by");

// ── CORS ──
app.use(
    cors(
        config.isProd && config.corsOrigins.length > 0
            ? { origin: config.corsOrigins, credentials: true }
            : {},
    ),
);

// ── Rate Limiting ──
app.use(globalLimiter);

// ── Body Parsing ──
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging (dev only) ──
if (config.isDev) {
    app.use(morgan("dev"));
}

// ── Public Routes ──
app.use(healthRoutes);
app.use(authRoutes);

// ── Protected Routes ──
app.get("/me", requireAuth, (req, res) => {
    res.json({ userId: req.user!.id });
});
app.use(projectRoutes);
app.use(templateRoutes);
app.use(snapshotRoutes);

// ── Global Error Handler (must be last) ──
app.use(errorMiddleware);

export default app;
