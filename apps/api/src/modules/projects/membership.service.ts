// ─────────────────────────────────────────────
// Membership Service
// ─────────────────────────────────────────────
// Business logic for managing project members.
// Enforces owner protection rules.
// ─────────────────────────────────────────────

import { pool } from "../../config/db";
import { isValidRole } from "../../config/capabilities";
import { logger } from "../../utils/logger";
import type {
    AddMemberInput,
    MemberResponse,
    MembershipRow,
    ProjectRole,
} from "./project.types";

/** Add or update a membership */
export async function addOrUpdateMember(
    projectId: string,
    actorId: string,
    input: AddMemberInput,
): Promise<MemberResponse> {
    const { email, role } = input;

    if (!email || !role) {
        throw Object.assign(new Error("email and role are required"), { statusCode: 400 });
    }

    if (!isValidRole(role)) {
        throw Object.assign(
            new Error(`Invalid role: ${role}. Must be owner, instructor, maintainer, or viewer`),
            { statusCode: 400 },
        );
    }

    // Look up user by email
    const userResult = await pool.query<{ id: string; email: string; name: string | null }>(
        `SELECT id, email, name FROM users WHERE email = $1`,
        [email.toLowerCase().trim()],
    );
    const user = userResult.rows[0];
    if (!user) {
        throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }

    // Prevent owner from downgrading themselves if they are the last owner
    const existingMembership = await pool.query<MembershipRow>(
        `SELECT * FROM project_memberships WHERE project_id = $1 AND user_id = $2`,
        [projectId, user.id],
    );
    if (existingMembership.rows[0]?.role === "owner" && role !== "owner") {
        const ownerCount = await pool.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM project_memberships
             WHERE project_id = $1 AND role = 'owner'`,
            [projectId],
        );
        if (parseInt(ownerCount.rows[0]!.count, 10) <= 1) {
            throw Object.assign(
                new Error("Cannot remove the last owner of a project"),
                { statusCode: 400 },
            );
        }
    }

    // Upsert membership
    await pool.query(
        `INSERT INTO project_memberships (project_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3, assigned_at = NOW()`,
        [projectId, user.id, role],
    );

    logger.info(
        `[ROLE_CHANGE] actor=${actorId} project=${projectId} target=${user.id} role=${role}`,
    );

    return {
        userId: user.id,
        email: user.email,
        name: user.name,
        role,
        assignedAt: new Date(),
    };
}

/** Get all members of a project */
export async function getMembers(projectId: string): Promise<MemberResponse[]> {
    const result = await pool.query<{
        user_id: string;
        email: string;
        name: string | null;
        role: ProjectRole;
        assigned_at: Date;
    }>(
        `SELECT pm.user_id, u.email, u.name, pm.role, pm.assigned_at
         FROM project_memberships pm
         INNER JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = $1
         ORDER BY pm.assigned_at ASC`,
        [projectId],
    );

    return result.rows.map((r) => ({
        userId: r.user_id,
        email: r.email,
        name: r.name,
        role: r.role,
        assignedAt: r.assigned_at,
    }));
}
