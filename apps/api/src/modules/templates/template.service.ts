// ─────────────────────────────────────────────
// Template Service
// ─────────────────────────────────────────────
// Versioned template persistence with:
// - Strict monotonic layout_version
// - SHA256 hash chain
// - Append-only audit logging
// - INSERT-only (never UPDATE/DELETE)
// - All writes inside transactions
// ─────────────────────────────────────────────

import crypto from "crypto";
import { pool } from "../../config/db";
import type {
    TemplateRow,
    TemplateResponse,
    UpdateTemplateInput,
    PanelModes,
    LockedPanels,
} from "./template.types";

// ── Helpers ──

/** Canonical JSON for deterministic hashing */
function canonicalJson(obj: unknown): string {
    return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/** SHA256( panelModes + lockedPanels + version + previousHash ) */
function computeTemplateHash(
    panelModes: PanelModes,
    lockedPanels: LockedPanels,
    layoutVersion: number,
    previousHash: string | null,
): string {
    const data =
        canonicalJson(panelModes) +
        canonicalJson(lockedPanels) +
        String(layoutVersion) +
        (previousHash ?? "");
    return crypto.createHash("sha256").update(data).digest("hex");
}

/** SHA256 for audit hash chain */
function computeAuditHash(
    actionType: string,
    layoutVersion: number,
    previousHash: string | null,
    changedKeys: Record<string, unknown> | null,
): string {
    const data =
        actionType +
        String(layoutVersion) +
        (previousHash ?? "") +
        canonicalJson(changedKeys ?? {});
    return crypto.createHash("sha256").update(data).digest("hex");
}

function toResponse(row: TemplateRow): TemplateResponse {
    return {
        id: row.id,
        projectId: row.project_id,
        layoutVersion: row.layout_version,
        panelModes: row.panel_modes,
        lockedPanels: row.locked_panels,
        templateHash: row.template_hash,
        previousHash: row.previous_hash,
        updatedBy: row.updated_by,
        createdAt: row.created_at,
    };
}

/** Compute changed keys between old and new states */
function diffKeys(
    oldModes: PanelModes | null,
    newModes: PanelModes,
    oldLocks: LockedPanels | null,
    newLocks: LockedPanels,
): { changedKeys: string[]; beforeState: Record<string, unknown>; afterState: Record<string, unknown> } {
    const changedKeys: string[] = [];
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    // Diff panel modes
    const allModeKeys = new Set([
        ...Object.keys(oldModes ?? {}),
        ...Object.keys(newModes),
    ]);
    for (const key of allModeKeys) {
        const oldVal = oldModes?.[key];
        const newVal = newModes[key];
        if (oldVal !== newVal) {
            changedKeys.push(`panelModes.${key}`);
            beforeState[`panelModes.${key}`] = oldVal ?? null;
            afterState[`panelModes.${key}`] = newVal ?? null;
        }
    }

    // Diff locked panels
    const allLockKeys = new Set([
        ...Object.keys(oldLocks ?? {}),
        ...Object.keys(newLocks),
    ]);
    for (const key of allLockKeys) {
        const oldVal = oldLocks?.[key];
        const newVal = newLocks[key];
        if (oldVal !== newVal) {
            changedKeys.push(`lockedPanels.${key}`);
            beforeState[`lockedPanels.${key}`] = oldVal ?? null;
            afterState[`lockedPanels.${key}`] = newVal ?? null;
        }
    }

    return { changedKeys, beforeState, afterState };
}

// ── Public API ──

/** Get latest template for a project (highest layout_version) */
export async function getLatestTemplate(
    projectId: string,
): Promise<TemplateResponse | null> {
    const result = await pool.query<TemplateRow>(
        `SELECT * FROM templates
         WHERE project_id = $1
         ORDER BY layout_version DESC
         LIMIT 1`,
        [projectId],
    );
    const row = result.rows[0];
    return row ? toResponse(row) : null;
}

/**
 * Update template with strict versioning.
 * All writes (template + audit) in a single transaction.
 * INSERT-only — never UPDATE or DELETE.
 */
export async function updateTemplate(
    projectId: string,
    userId: string,
    userRole: string,
    input: UpdateTemplateInput,
): Promise<TemplateResponse> {
    const { panelModes, lockedPanels, baseVersion } = input;

    // Validate input
    if (!panelModes || typeof panelModes !== "object") {
        throw Object.assign(new Error("panelModes is required and must be an object"), { statusCode: 400 });
    }
    if (!lockedPanels || typeof lockedPanels !== "object") {
        throw Object.assign(new Error("lockedPanels is required and must be an object"), { statusCode: 400 });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Lock the project row to prevent concurrent inserts
        // (SELECT FOR UPDATE on the latest template)
        const latestResult = await client.query<TemplateRow>(
            `SELECT * FROM templates
             WHERE project_id = $1
             ORDER BY layout_version DESC
             LIMIT 1
             FOR UPDATE`,
            [projectId],
        );
        const latest = latestResult.rows[0] ?? null;

        let newVersion: number;
        let previousHash: string | null;

        if (!latest) {
            // First template — version 1
            newVersion = 1;
            previousHash = null;
        } else {
            // Conflict detection: baseVersion must match latest
            if (baseVersion !== latest.layout_version) {
                throw Object.assign(
                    new Error(
                        `Version conflict: expected baseVersion ${latest.layout_version}, got ${baseVersion}`,
                    ),
                    { statusCode: 409 },
                );
            }
            newVersion = latest.layout_version + 1;
            previousHash = latest.template_hash;
        }

        // Compute template hash
        const templateHash = computeTemplateHash(
            panelModes,
            lockedPanels,
            newVersion,
            previousHash,
        );

        // INSERT new template row (never UPDATE)
        const insertResult = await client.query<TemplateRow>(
            `INSERT INTO templates (
                project_id, layout_version, panel_modes, locked_panels,
                template_hash, previous_hash, updated_by
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                projectId,
                newVersion,
                JSON.stringify(panelModes),
                JSON.stringify(lockedPanels),
                templateHash,
                previousHash,
                userId,
            ],
        );
        const newTemplate = insertResult.rows[0]!;

        // Compute audit diff
        const { changedKeys, beforeState, afterState } = diffKeys(
            latest?.panel_modes ?? null,
            panelModes,
            latest?.locked_panels ?? null,
            lockedPanels,
        );

        // Compute audit hash chain
        // Get previous audit hash for this project
        const prevAuditResult = await client.query<{ hash: string }>(
            `SELECT hash FROM audit_logs
             WHERE project_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [projectId],
        );
        const prevAuditHash = prevAuditResult.rows[0]?.hash ?? null;

        const auditHash = computeAuditHash(
            "template_update",
            newVersion,
            prevAuditHash,
            { keys: changedKeys },
        );

        // INSERT audit entry (never UPDATE)
        await client.query(
            `INSERT INTO audit_logs (
                project_id, user_id, role, action_type,
                changed_keys, before_state, after_state,
                layout_version, previous_hash, hash
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                projectId,
                userId,
                userRole,
                "template_update",
                JSON.stringify(changedKeys),
                JSON.stringify(beforeState),
                JSON.stringify(afterState),
                newVersion,
                prevAuditHash,
                auditHash,
            ],
        );

        await client.query("COMMIT");
        return toResponse(newTemplate);
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/** Get full version history for a project */
export async function getTemplateHistory(
    projectId: string,
): Promise<TemplateResponse[]> {
    const result = await pool.query<TemplateRow>(
        `SELECT * FROM templates
         WHERE project_id = $1
         ORDER BY layout_version ASC`,
        [projectId],
    );
    return result.rows.map(toResponse);
}
