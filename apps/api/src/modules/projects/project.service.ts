// ─────────────────────────────────────────────
// Project Service
// ─────────────────────────────────────────────
// Business logic for project CRUD.
// On create: inserts project + owner membership
// in a transaction.
// ─────────────────────────────────────────────

import { pool } from "../../config/db";
import type {
    CreateProjectInput,
    ProjectRow,
    ProjectResponse,
    ProjectRole,
} from "./project.types";

function toResponse(row: ProjectRow, role: ProjectRole): ProjectResponse {
    return {
        id: row.id,
        name: row.name,
        sourceCode: row.source_code,
        compilerVersion: row.compiler_version,
        ownerId: row.owner_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        role,
    };
}

/** Create project + owner membership in a single transaction */
export async function createProject(
    userId: string,
    input: CreateProjectInput,
): Promise<ProjectResponse> {
    const { name, sourceCode, compilerVersion } = input;

    if (!name || !sourceCode || !compilerVersion) {
        throw Object.assign(
            new Error("name, sourceCode, and compilerVersion are required"),
            { statusCode: 400 },
        );
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const projectResult = await client.query<ProjectRow>(
            `INSERT INTO projects (owner_id, name, source_code, compiler_version)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, name, sourceCode, compilerVersion],
        );
        const project = projectResult.rows[0]!;

        await client.query(
            `INSERT INTO project_memberships (project_id, user_id, role)
             VALUES ($1, $2, 'owner')`,
            [project.id, userId],
        );

        await client.query("COMMIT");
        return toResponse(project, "owner");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/** Get all projects where user is a member */
export async function getUserProjects(userId: string): Promise<ProjectResponse[]> {
    const result = await pool.query<ProjectRow & { role: ProjectRole }>(
        `SELECT p.*, pm.role
         FROM projects p
         INNER JOIN project_memberships pm ON pm.project_id = p.id
         WHERE pm.user_id = $1
         ORDER BY p.updated_at DESC`,
        [userId],
    );

    return result.rows.map((row) => toResponse(row, row.role));
}

/** Get single project (caller must have membership — enforced by middleware) */
export async function getProject(
    projectId: string,
    role: ProjectRole,
): Promise<ProjectResponse | null> {
    const result = await pool.query<ProjectRow>(
        `SELECT * FROM projects WHERE id = $1`,
        [projectId],
    );
    const row = result.rows[0];
    return row ? toResponse(row, role) : null;
}
