// ─────────────────────────────────────────────
// chronovm-governance — Audit Logging
// ─────────────────────────────────────────────
// Pure functions for creating, validating, and
// computing deterministic audit entries.
// No mutation. No IO. Append-only log semantics.
// ─────────────────────────────────────────────

import type { PanelId, PanelModeMap, ProjectRole, ViewMode } from './roles.ts';
import { ALL_PANELS } from './roles.ts';

// ── Action Types (Part 2) ──

export type AuditAction =
    | 'template_create'
    | 'template_update'
    | 'template_reset'
    | 'draft_publish'
    | 'role_change'
    | 'panel_lock'
    | 'force_sync'
    | 'rollback';

/** All valid AuditAction values, for exhaustive iteration and validation. */
export const ALL_AUDIT_ACTIONS: readonly AuditAction[] = [
    'template_create',
    'template_update',
    'template_reset',
    'draft_publish',
    'role_change',
    'panel_lock',
    'force_sync',
    'rollback',
] as const;

const ALL_AUDIT_ACTIONS_SET: ReadonlySet<string> = new Set(ALL_AUDIT_ACTIONS);

/** Runtime check — is this a valid AuditAction? */
export function isValidAuditAction(value: string): value is AuditAction {
    return ALL_AUDIT_ACTIONS_SET.has(value);
}

// ── Audit Entry (Part 1) ──

export interface LayoutAuditEntry {
    readonly entryId: string;               // UUID — unique per entry
    readonly projectId: string;
    readonly userId: string;
    readonly role: ProjectRole;              // role at time of action
    readonly timestamp: string;             // ISO8601 — externally provided
    readonly action: AuditAction;
    readonly changedKeys: readonly PanelId[];
    readonly before: Partial<Readonly<Record<PanelId, ViewMode>>>;
    readonly after: Partial<Readonly<Record<PanelId, ViewMode>>>;
    readonly layoutVersion: number;         // post-change version
    readonly previousHash: string;          // hash of prior entry for integrity chain
    readonly metadata: Readonly<Record<string, unknown>>;
}

// ── Delta Computation (Parts 3–4) ──

/**
 * Result of computing a diff between two PanelModeMap snapshots.
 */
export interface AuditDelta {
    readonly changedKeys: readonly PanelId[];
    readonly before: Partial<Readonly<Record<PanelId, ViewMode>>>;
    readonly after: Partial<Readonly<Record<PanelId, ViewMode>>>;
}

/**
 * Compute the delta between two PanelModeMap snapshots.
 *
 * Records only the changed panel keys — not the full layout,
 * not derived state, not user overrides, not execution data.
 *
 * Deterministic: given the same before/after state, the delta
 * is always identical. Iterates ALL_PANELS in canonical order.
 *
 * Pure function — no side effects.
 */
export function computeAuditDelta(
    beforeState: PanelModeMap,
    afterState: PanelModeMap,
): AuditDelta {
    const changedKeys: PanelId[] = [];
    const before: Partial<Record<PanelId, ViewMode>> = {};
    const after: Partial<Record<PanelId, ViewMode>> = {};

    for (const panelId of ALL_PANELS) {
        const bVal = beforeState[panelId];
        const aVal = afterState[panelId];
        if (bVal !== aVal) {
            changedKeys.push(panelId);
            before[panelId] = bVal;
            after[panelId] = aVal;
        }
    }

    return { changedKeys, before, after };
}

// ── Factory ──

/**
 * Create an audit entry. Pure factory — no side effects.
 *
 * The caller is responsible for generating `entryId`, `timestamp`,
 * `layoutVersion`, and `previousHash`. This function never generates
 * IDs, timestamps, or hashes internally (determinism guarantee).
 */
export function createAuditEntry(
    entryId: string,
    projectId: string,
    userId: string,
    role: ProjectRole,
    timestamp: string,
    action: AuditAction,
    changedKeys: readonly PanelId[],
    before: Partial<Readonly<Record<PanelId, ViewMode>>>,
    after: Partial<Readonly<Record<PanelId, ViewMode>>>,
    metadata: Readonly<Record<string, unknown>> = {},
    layoutVersion: number = 0,
    previousHash: string = '',
): LayoutAuditEntry {
    return {
        entryId,
        projectId,
        userId,
        role,
        timestamp,
        action,
        changedKeys,
        before,
        after,
        layoutVersion,
        previousHash,
        metadata,
    };
}

/**
 * Create an audit entry from a computed delta.
 * Convenience wrapper that combines `computeAuditDelta` with `createAuditEntry`.
 *
 * Pure function — deterministic, no side effects.
 */
export function createAuditEntryFromDelta(
    entryId: string,
    projectId: string,
    userId: string,
    role: ProjectRole,
    timestamp: string,
    action: AuditAction,
    beforeState: PanelModeMap,
    afterState: PanelModeMap,
    layoutVersion: number,
    previousHash: string = '',
    metadata: Readonly<Record<string, unknown>> = {},
): LayoutAuditEntry {
    const delta = computeAuditDelta(beforeState, afterState);
    return createAuditEntry(
        entryId, projectId, userId, role, timestamp, action,
        delta.changedKeys, delta.before, delta.after,
        metadata, layoutVersion, previousHash,
    );
}

// ── Validation ──

/**
 * Validate that an audit entry is well-formed.
 * Returns list of validation errors (empty = valid).
 */
export function validateAuditEntry(entry: LayoutAuditEntry): readonly string[] {
    const errors: string[] = [];

    if (!entry.entryId) errors.push('entryId is required');
    if (!entry.projectId) errors.push('projectId is required');
    if (!entry.userId) errors.push('userId is required');
    if (!entry.role) errors.push('role is required');
    if (!entry.timestamp) errors.push('timestamp is required');
    if (!entry.action) errors.push('action is required');

    if (!isValidAuditAction(entry.action)) {
        errors.push(`Unknown action: '${entry.action}'`);
    }

    // changedKeys should match the keys in before/after
    const beforeKeys = Object.keys(entry.before);
    const afterKeys = Object.keys(entry.after);

    for (const key of entry.changedKeys) {
        if (!beforeKeys.includes(key) && !afterKeys.includes(key)) {
            errors.push(`changedKey '${key}' not found in before or after`);
        }
    }

    return errors;
}

// ── Log Integrity (Part 5) ──

/**
 * Verify that a sequence of audit entries has:
 * - Monotonically increasing timestamps.
 * - Consistent projectId across entries.
 * - No duplicate entryIds (append-only guarantee).
 *
 * Returns list of integrity violations (empty = valid).
 */
export function verifyLogIntegrity(
    entries: readonly LayoutAuditEntry[],
): readonly string[] {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
        const curr = entries[i]!;

        // Uniqueness: no duplicate entryIds (append-only, never edited)
        if (seenIds.has(curr.entryId)) {
            errors.push(
                `Duplicate entryId '${curr.entryId}' at index ${i}`,
            );
        }
        seenIds.add(curr.entryId);

        // Order + consistency checks (need at least 2 entries)
        if (i > 0) {
            const prev = entries[i - 1]!;

            if (curr.timestamp < prev.timestamp) {
                errors.push(
                    `Entry ${i} timestamp (${curr.timestamp}) ` +
                    `precedes entry ${i - 1} timestamp (${prev.timestamp})`,
                );
            }

            if (curr.projectId !== prev.projectId) {
                errors.push(
                    `Entry ${i} projectId (${curr.projectId}) ` +
                    `differs from entry ${i - 1} projectId (${prev.projectId})`,
                );
            }
        }
    }

    return errors;
}
