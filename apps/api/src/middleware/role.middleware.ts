// ─────────────────────────────────────────────
// Role Enforcement Middleware
// ─────────────────────────────────────────────
// Fetches membership from DB (never from client),
// checks capability, attaches membership to req.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { pool } from "../config/db";
import { hasCapability } from "../config/capabilities";
import type { Capability } from "../config/capabilities";
import type { MembershipRow } from "../modules/projects/project.types";

// Extend Request with project membership
declare global {
    namespace Express {
        interface Request {
            membership?: MembershipRow;
        }
    }
}

/**
 * Middleware factory: checks if the authenticated user
 * has the required capability for the project in :id.
 */
export function requireProjectRole(capability: Capability) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const projectId = req.params.id;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
            return;
        }

        if (!projectId) {
            res.status(400).json({ error: { code: "BAD_REQUEST", message: "Project ID required" } });
            return;
        }

        try {
            const result = await pool.query<MembershipRow>(
                `SELECT project_id, user_id, role, assigned_at
                 FROM project_memberships
                 WHERE project_id = $1 AND user_id = $2`,
                [projectId, userId],
            );

            const membership = result.rows[0];
            if (!membership) {
                res.status(403).json({ error: { code: "FORBIDDEN", message: "Not a member of this project" } });
                return;
            }

            if (!hasCapability(membership.role, capability)) {
                res.status(403).json({
                    error: { code: "FORBIDDEN", message: `Insufficient permissions: requires ${capability}` },
                });
                return;
            }

            // Attach membership for downstream handlers
            req.membership = membership;
            next();
        } catch (err) {
            next(err);
        }
    };
}
