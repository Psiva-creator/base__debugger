// ─────────────────────────────────────────────
// Snapshot Service
// ─────────────────────────────────────────────
// Immutable, forkable, deterministic snapshots.
// - INSERT-only (no UPDATE/DELETE on snapshot data)
// - SHA256 snapshot_hash for integrity verification
// - Fork creates independent project from snapshot
// - Visibility only field allowed to change
// ─────────────────────────────────────────────

import crypto from "crypto";
import { pool } from "../../config/db";
import type {
    SnapshotRow,
    SnapshotResponse,
    CreateSnapshotInput,
    SnapshotVisibility,
} from "./snapshot.types";
import type { ProjectRow } from "../projects/project.types";
import type { TemplateRow } from "../templates/template.types";

// ── Helpers ──

function canonicalJson(obj: unknown): string {
    return JSON.stringify(obj, Object.keys(obj as object).sort());
}

function computeSnapshotHash(
    sourceCode: string,
    compilerVersion: string,
    templateSnapshot: Record<string, unknown>,
    overrideSnapshot: Record<string, unknown> | null,
    executionHash: string,
    microIndex: number,
): string {
    const data =
        sourceCode +
        compilerVersion +
        JSON.stringify(templateSnapshot) +
        JSON.stringify(overrideSnapshot) +
        executionHash +
        String(microIndex);
    return crypto.createHash("sha256").update(data).digest("hex");
}

function toResponse(row: SnapshotRow): SnapshotResponse {
    return {
        id: row.id,
        projectId: row.project_id,
        createdBy: row.created_by,
        visibility: row.visibility,
        sourceCode: row.source_code,
        compilerVersion: row.compiler_version,
        templateSnapshot: row.template_snapshot,
        overrideSnapshot: row.override_snapshot,
        executionHash: row.execution_hash,
        snapshotHash: row.snapshot_hash,
        microIndex: row.micro_index,
        createdAt: row.created_at,
    };
}

// ── Public API ──

/** Create an immutable snapshot inside a transaction */
export async function createSnapshot(
    projectId: string,
    userId: string,
    input: CreateSnapshotInput,
): Promise<SnapshotResponse> {
    const { microIndex, executionHash } = input;

    if (microIndex == null || typeof microIndex !== "number" || microIndex < 0) {
        throw Object.assign(new Error("microIndex must be a non-negative integer"), { statusCode: 400 });
    }
    if (!executionHash || typeof executionHash !== "string") {
        throw Object.assign(new Error("executionHash is required"), { statusCode: 400 });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Fetch project
        const projectResult = await client.query<ProjectRow>(
            `SELECT * FROM projects WHERE id = $1`,
            [projectId],
        );
        const project = projectResult.rows[0];
        if (!project) {
            throw Object.assign(new Error("Project not found"), { statusCode: 404 });
        }

        // 2. Fetch latest template
        const templateResult = await client.query<TemplateRow>(
            `SELECT * FROM templates
             WHERE project_id = $1
             ORDER BY layout_version DESC
             LIMIT 1`,
            [projectId],
        );
        const template = templateResult.rows[0];
        const templateSnapshot = template
            ? { panelModes: template.panel_modes, lockedPanels: template.locked_panels, layoutVersion: template.layout_version }
            : { panelModes: {}, lockedPanels: {}, layoutVersion: 0 };

        // 3. Override snapshot (placeholder — no user override table yet)
        const overrideSnapshot = null;

        // 4. Compute snapshot hash
        const snapshotHash = computeSnapshotHash(
            project.source_code,
            project.compiler_version,
            templateSnapshot,
            overrideSnapshot,
            executionHash,
            microIndex,
        );

        // 5. INSERT snapshot (immutable — never UPDATE)
        const insertResult = await client.query<SnapshotRow>(
            `INSERT INTO snapshots (
                project_id, created_by, source_code, compiler_version,
                template_snapshot, override_snapshot,
                execution_hash, snapshot_hash, micro_index
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                projectId,
                userId,
                project.source_code,
                project.compiler_version,
                JSON.stringify(templateSnapshot),
                overrideSnapshot ? JSON.stringify(overrideSnapshot) : null,
                executionHash,
                snapshotHash,
                microIndex,
            ],
        );

        await client.query("COMMIT");
        return toResponse(insertResult.rows[0]!);
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/** Load a snapshot with visibility enforcement */
export async function getSnapshot(
    snapshotId: string,
    userId: string | null,
): Promise<SnapshotResponse> {
    const result = await pool.query<SnapshotRow>(
        `SELECT * FROM snapshots WHERE id = $1`,
        [snapshotId],
    );
    const snapshot = result.rows[0];
    if (!snapshot) {
        throw Object.assign(new Error("Snapshot not found"), { statusCode: 404 });
    }

    // Visibility enforcement
    if (snapshot.visibility === "private" && snapshot.created_by !== userId) {
        throw Object.assign(new Error("Snapshot not found"), { statusCode: 404 });
    }

    // Verify hash integrity on load
    const expectedHash = computeSnapshotHash(
        snapshot.source_code,
        snapshot.compiler_version,
        snapshot.template_snapshot,
        snapshot.override_snapshot,
        snapshot.execution_hash,
        snapshot.micro_index,
    );
    if (expectedHash !== snapshot.snapshot_hash) {
        throw Object.assign(
            new Error("Snapshot integrity check failed — hash mismatch"),
            { statusCode: 500 },
        );
    }

    return toResponse(snapshot);
}

/** Toggle visibility (only allowed change on a snapshot) */
export async function updateVisibility(
    snapshotId: string,
    userId: string,
    visibility: SnapshotVisibility,
): Promise<SnapshotResponse> {
    if (visibility !== "private" && visibility !== "public") {
        throw Object.assign(new Error("visibility must be 'private' or 'public'"), { statusCode: 400 });
    }

    const result = await pool.query<SnapshotRow>(
        `SELECT * FROM snapshots WHERE id = $1`,
        [snapshotId],
    );
    const snapshot = result.rows[0];
    if (!snapshot) {
        throw Object.assign(new Error("Snapshot not found"), { statusCode: 404 });
    }
    if (snapshot.created_by !== userId) {
        throw Object.assign(new Error("Only snapshot owner can change visibility"), { statusCode: 403 });
    }

    // Visibility is the ONLY mutable field
    const updated = await pool.query<SnapshotRow>(
        `UPDATE snapshots SET visibility = $1 WHERE id = $2 RETURNING *`,
        [visibility, snapshotId],
    );
    return toResponse(updated.rows[0]!);
}

/** Fork a snapshot into a new independent project */
export async function forkSnapshot(
    snapshotId: string,
    userId: string,
): Promise<{ projectId: string }> {
    // Load snapshot (with visibility check)
    const snapshot = await getSnapshot(snapshotId, userId);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Create new project
        const projectResult = await client.query<ProjectRow>(
            `INSERT INTO projects (owner_id, name, source_code, compiler_version)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                userId,
                `Fork of ${snapshot.projectId.slice(0, 8)}`,
                snapshot.sourceCode,
                snapshot.compilerVersion,
            ],
        );
        const project = projectResult.rows[0]!;

        // 2. Insert owner membership
        await client.query(
            `INSERT INTO project_memberships (project_id, user_id, role)
             VALUES ($1, $2, 'owner')`,
            [project.id, userId],
        );

        // 3. Insert template version 1 from snapshot
        const templateData = snapshot.templateSnapshot as {
            panelModes?: Record<string, unknown>;
            lockedPanels?: Record<string, unknown>;
        };
        const panelModes = templateData.panelModes ?? {};
        const lockedPanels = templateData.lockedPanels ?? {};

        // Compute hash for forked template
        const canonicalPanelModes = canonicalJson(panelModes);
        const canonicalLockedPanels = canonicalJson(lockedPanels);
        const templateHash = crypto
            .createHash("sha256")
            .update(canonicalPanelModes + canonicalLockedPanels + "1")
            .digest("hex");

        await client.query(
            `INSERT INTO templates (
                project_id, layout_version, panel_modes, locked_panels,
                template_hash, previous_hash, updated_by
             ) VALUES ($1, 1, $2, $3, $4, NULL, $5)`,
            [
                project.id,
                JSON.stringify(panelModes),
                JSON.stringify(lockedPanels),
                templateHash,
                userId,
            ],
        );

        await client.query("COMMIT");
        return { projectId: project.id };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/** List snapshots for a project */
export async function getProjectSnapshots(
    projectId: string,
): Promise<SnapshotResponse[]> {
    const result = await pool.query<SnapshotRow>(
        `SELECT * FROM snapshots
         WHERE project_id = $1
         ORDER BY created_at DESC`,
        [projectId],
    );
    return result.rows.map(toResponse);
}
