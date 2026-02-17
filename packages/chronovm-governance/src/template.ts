// ─────────────────────────────────────────────
// chronovm-governance — Template Operations
// ─────────────────────────────────────────────
// Pure functions for creating, updating, and resetting
// project layout templates. No mutation. No IO.
// Includes versioning system for monotonic history.
// ─────────────────────────────────────────────

import type { PanelId, PanelModeMap, ProjectRole, ViewMode } from './roles.ts';
import { ALL_PANELS, DEFAULT_PANEL_MODES, isAllowed } from './roles.ts';
import type { AuditAction } from './audit.ts';

// ── Template Entity ──

export interface ProjectTemplateLayout {
    readonly projectId: string;
    readonly layoutVersion: number;
    readonly panelModes: PanelModeMap;
    readonly lockedPanels: readonly PanelId[];
    readonly updatedBy: string;
    readonly updatedAt: string; // ISO8601
    readonly previousHash: string; // hash of prior version for chain integrity
}

// ── Factory ──

/**
 * Create a brand-new project template with system defaults.
 */
export function createTemplate(
    projectId: string,
    createdBy: string,
    createdAt: string,
): ProjectTemplateLayout {
    return {
        projectId,
        layoutVersion: 1,
        panelModes: DEFAULT_PANEL_MODES,
        lockedPanels: [],
        updatedBy: createdBy,
        updatedAt: createdAt,
        previousHash: '',
    };
}

// ── Update ──

export interface TemplateUpdateInput {
    readonly panelModes?: Partial<Readonly<Record<PanelId, ViewMode>>>;
    readonly lockedPanels?: readonly PanelId[];
}

export type TemplateUpdateResult =
    | { ok: true; template: ProjectTemplateLayout }
    | { ok: false; reason: string };

/**
 * Apply a partial update to a template. Returns a new template
 * with bumped layoutVersion. Pure — no mutation.
 *
 * Validates role permission before applying.
 */
export function updateTemplate(
    current: ProjectTemplateLayout,
    update: TemplateUpdateInput,
    userId: string,
    role: ProjectRole,
    timestamp: string,
    newHash: string,
): TemplateUpdateResult {
    if (!isAllowed(role, 'template:edit')) {
        return { ok: false, reason: `Role '${role}' cannot edit template` };
    }

    const nextModes: PanelModeMap = update.panelModes
        ? { ...current.panelModes, ...update.panelModes } as PanelModeMap
        : current.panelModes;

    const nextLocked: readonly PanelId[] = update.lockedPanels !== undefined
        ? update.lockedPanels
        : current.lockedPanels;

    // Validate locked panels are valid PanelIds
    for (const p of nextLocked) {
        if (!ALL_PANELS.includes(p)) {
            return { ok: false, reason: `Invalid panel id: '${p}'` };
        }
    }

    return {
        ok: true,
        template: {
            projectId: current.projectId,
            layoutVersion: current.layoutVersion + 1,
            panelModes: nextModes,
            lockedPanels: nextLocked,
            updatedBy: userId,
            updatedAt: timestamp,
            previousHash: newHash,
        },
    };
}

// ── Reset ──

/**
 * Reset template to system defaults. Only 'owner' may do this.
 */
export function resetTemplate(
    current: ProjectTemplateLayout,
    userId: string,
    role: ProjectRole,
    timestamp: string,
    newHash: string,
): TemplateUpdateResult {
    if (!isAllowed(role, 'template:reset')) {
        return { ok: false, reason: `Role '${role}' cannot reset template` };
    }

    return {
        ok: true,
        template: {
            projectId: current.projectId,
            layoutVersion: current.layoutVersion + 1,
            panelModes: DEFAULT_PANEL_MODES,
            lockedPanels: [],
            updatedBy: userId,
            updatedAt: timestamp,
            previousHash: newHash,
        },
    };
}

// ── Template Diff ──

export interface TemplateDiff {
    readonly changedPanels: readonly PanelId[];
    readonly before: Partial<Readonly<Record<PanelId, ViewMode>>>;
    readonly after: Partial<Readonly<Record<PanelId, ViewMode>>>;
}

/**
 * Compute the diff between two templates.
 */
export function diffTemplates(
    prev: ProjectTemplateLayout,
    next: ProjectTemplateLayout,
): TemplateDiff {
    const changedPanels: PanelId[] = [];
    const before: Partial<Record<PanelId, ViewMode>> = {};
    const after: Partial<Record<PanelId, ViewMode>> = {};

    for (const p of ALL_PANELS) {
        if (prev.panelModes[p] !== next.panelModes[p]) {
            changedPanels.push(p);
            before[p] = prev.panelModes[p];
            after[p] = next.panelModes[p];
        }
    }

    return { changedPanels, before, after };
}

// ═══════════════════════════════════════════════════
// Layout Versioning System
// ═══════════════════════════════════════════════════

// ── Part 2: Version Increment Triggers ──

/** Actions that MUST increment layoutVersion. */
export const VERSION_INCREMENT_TRIGGERS: readonly AuditAction[] = [
    'template_create',
    'template_update',
    'template_reset',
    'draft_publish',
    'rollback',
    'panel_lock',
] as const;

/** Actions that must NOT increment layoutVersion. */
export const VERSION_NO_INCREMENT_ACTIONS: readonly AuditAction[] = [
    'role_change',
    'force_sync',
] as const;

const INCREMENT_SET: ReadonlySet<string> = new Set(VERSION_INCREMENT_TRIGGERS);

/** Pure guard: should this action type increment layoutVersion? */
export function shouldIncrementVersion(action: AuditAction): boolean {
    return INCREMENT_SET.has(action);
}

// ── Parts 3–4: Version Conflict Handling ──

export type VersionConflict =
    | { ok: true }
    | { ok: false; reason: string };

/**
 * Validate that a client's expected version matches the current template
 * before allowing a write. Prevents stale-version writes and version skipping.
 *
 * Rules:
 * - Client must present the EXACT current layoutVersion.
 * - If client version < current → stale (must re-fetch).
 * - If client version > current → invalid (version skipping).
 *
 * Pure function — no side effects.
 */
export function validateVersionForUpdate(
    clientVersion: number,
    currentTemplate: ProjectTemplateLayout,
): VersionConflict {
    if (clientVersion < currentTemplate.layoutVersion) {
        return {
            ok: false,
            reason: `Stale version: client has v${clientVersion}, template is at v${currentTemplate.layoutVersion}. Re-fetch required.`,
        };
    }
    if (clientVersion > currentTemplate.layoutVersion) {
        return {
            ok: false,
            reason: `Invalid version: client has v${clientVersion}, but template is only at v${currentTemplate.layoutVersion}. Version skipping not allowed.`,
        };
    }
    return { ok: true };
}

// ── Part 2: Additional Template Operations ──

/**
 * Publish a draft template. Bumps layoutVersion by exactly +1.
 * Only 'owner' or 'instructor' may publish.
 *
 * Pure function — atomic: returns new template or error, never partial state.
 */
export function publishDraft(
    current: ProjectTemplateLayout,
    draftModes: PanelModeMap,
    draftLockedPanels: readonly PanelId[],
    userId: string,
    role: ProjectRole,
    timestamp: string,
    newHash: string,
): TemplateUpdateResult {
    if (!isAllowed(role, 'template:edit')) {
        return { ok: false, reason: `Role '${role}' cannot publish draft` };
    }

    for (const p of draftLockedPanels) {
        if (!ALL_PANELS.includes(p)) {
            return { ok: false, reason: `Invalid panel id: '${p}'` };
        }
    }

    return {
        ok: true,
        template: {
            projectId: current.projectId,
            layoutVersion: current.layoutVersion + 1,
            panelModes: draftModes,
            lockedPanels: draftLockedPanels,
            updatedBy: userId,
            updatedAt: timestamp,
            previousHash: newHash,
        },
    };
}

/**
 * Rollback to a previous template state. Creates a NEW version
 * (does NOT overwrite or erase history — Part 5).
 *
 * The target state is provided as a snapshot; the resulting template
 * gets layoutVersion = current + 1 (never the old version number).
 *
 * Only 'owner' may rollback.
 */
export function rollbackTemplate(
    current: ProjectTemplateLayout,
    targetState: { panelModes: PanelModeMap; lockedPanels: readonly PanelId[] },
    userId: string,
    role: ProjectRole,
    timestamp: string,
    newHash: string,
): TemplateUpdateResult {
    if (!isAllowed(role, 'template:reset')) {
        return { ok: false, reason: `Role '${role}' cannot rollback template` };
    }

    return {
        ok: true,
        template: {
            projectId: current.projectId,
            layoutVersion: current.layoutVersion + 1,
            panelModes: targetState.panelModes,
            lockedPanels: targetState.lockedPanels,
            updatedBy: userId,
            updatedAt: timestamp,
            previousHash: newHash,
        },
    };
}

// ── Part 5: Version Integrity Verification ──

/**
 * Verify that a sequence of templates maintains monotonic version integrity.
 *
 * Checks:
 * - layoutVersion strictly increases by +1.
 * - No duplicate version numbers.
 * - Timestamps are monotonically non-decreasing.
 * - projectId is consistent across all entries.
 *
 * Returns list of violations (empty = valid).
 * Pure function — no side effects.
 */
export function verifyVersionIntegrity(
    templates: readonly ProjectTemplateLayout[],
): readonly string[] {
    const errors: string[] = [];
    const seenVersions = new Set<number>();

    for (let i = 0; i < templates.length; i++) {
        const curr = templates[i]!;

        // No duplicate versions
        if (seenVersions.has(curr.layoutVersion)) {
            errors.push(
                `Duplicate layoutVersion ${curr.layoutVersion} at index ${i}`,
            );
        }
        seenVersions.add(curr.layoutVersion);

        if (i > 0) {
            const prev = templates[i - 1]!;

            // Strictly +1
            if (curr.layoutVersion !== prev.layoutVersion + 1) {
                errors.push(
                    `Version gap: v${prev.layoutVersion} → v${curr.layoutVersion} at index ${i} (expected v${prev.layoutVersion + 1})`,
                );
            }

            // Timestamps non-decreasing
            if (curr.updatedAt < prev.updatedAt) {
                errors.push(
                    `Timestamp regression at index ${i}: '${curr.updatedAt}' < '${prev.updatedAt}'`,
                );
            }

            // Consistent projectId
            if (curr.projectId !== prev.projectId) {
                errors.push(
                    `ProjectId mismatch at index ${i}: '${curr.projectId}' vs '${prev.projectId}'`,
                );
            }
        }
    }

    return errors;
}

// ═══════════════════════════════════════════════════
// Rollback Reconstruction Logic
// ═══════════════════════════════════════════════════

// ── Rollback Result ──

export type ReconstructionResult =
    | { ok: true; snapshot: ProjectTemplateLayout }
    | { ok: false; reason: string };

export interface RollbackResult {
    readonly ok: true;
    readonly template: ProjectTemplateLayout;
    readonly targetVersion: number;
    readonly previousVersion: number;
    readonly reconstructedFrom: ProjectTemplateLayout;
}

export type RollbackOutcome =
    | RollbackResult
    | { ok: false; reason: string };

// ── Part 3: Reconstruction Strategy (Option A — Snapshots) ──

/**
 * Reconstruct template state at a given version by looking up the
 * snapshot in version history.
 *
 * Strategy: Option A — full snapshot per version.
 * The caller provides the complete version history as an ordered
 * array of immutable snapshots. This function finds the one matching
 * `targetVersion`.
 *
 * Pure function — deterministic, no side effects.
 */
export function reconstructTemplateAtVersion(
    history: readonly ProjectTemplateLayout[],
    targetVersion: number,
): ReconstructionResult {
    const snapshot = history.find(t => t.layoutVersion === targetVersion);
    if (!snapshot) {
        return {
            ok: false,
            reason: `Version ${targetVersion} not found in history (${history.length} entries)`,
        };
    }
    return { ok: true, snapshot };
}

// ── Parts 1–2: Rollback Pipeline ──

/**
 * Perform a full rollback to a previous template version.
 *
 * Pipeline:
 * 1. Validate targetVersion < current version.
 * 2. Reconstruct template state at targetVersion from history.
 * 3. Publish reconstructed state as version current + 1.
 * 4. Return result with metadata for audit entry generation.
 *
 * Philosophy (Part 1):
 * - Does NOT delete history.
 * - Does NOT decrement layoutVersion.
 * - Does NOT overwrite prior template record.
 * - Creates a NEW version with the old state.
 *
 * Only 'owner' may rollback.
 * Pure function — no side effects, no mutation.
 */
export function performRollback(
    current: ProjectTemplateLayout,
    targetVersion: number,
    history: readonly ProjectTemplateLayout[],
    userId: string,
    role: ProjectRole,
    timestamp: string,
    newHash: string,
): RollbackOutcome {
    // Permission check
    if (!isAllowed(role, 'template:reset')) {
        return { ok: false, reason: `Role '${role}' cannot rollback template` };
    }

    // Target must be a previous version
    if (targetVersion >= current.layoutVersion) {
        return {
            ok: false,
            reason: `Target version ${targetVersion} must be less than current version ${current.layoutVersion}`,
        };
    }

    if (targetVersion < 1) {
        return {
            ok: false,
            reason: `Target version ${targetVersion} is invalid (must be >= 1)`,
        };
    }

    // Reconstruct from history (Part 3)
    const reconstruction = reconstructTemplateAtVersion(history, targetVersion);
    if (!reconstruction.ok) {
        return reconstruction;
    }

    const snapshot = reconstruction.snapshot;

    // Create NEW version (never revert version number — Part 1)
    const newTemplate: ProjectTemplateLayout = {
        projectId: current.projectId,
        layoutVersion: current.layoutVersion + 1,
        panelModes: snapshot.panelModes,
        lockedPanels: snapshot.lockedPanels,
        updatedBy: userId,
        updatedAt: timestamp,
        previousHash: newHash,
    };

    return {
        ok: true,
        template: newTemplate,
        targetVersion,
        previousVersion: current.layoutVersion,
        reconstructedFrom: snapshot,
    };
}

// ── Part 6: Rollback Integrity Verification ──

/**
 * Verify rollback-specific integrity invariants across a version history.
 *
 * In addition to the general version integrity checks, this verifies:
 * - Rollback entries (where panelModes match a prior version) still
 *   have a strictly increasing layoutVersion.
 * - No version number is ever reused (even after rollback).
 * - The history is append-only: the array length never shrinks.
 *
 * This function calls verifyVersionIntegrity internally and appends
 * any rollback-specific violations.
 *
 * Pure function — no side effects.
 */
export function verifyRollbackIntegrity(
    history: readonly ProjectTemplateLayout[],
): readonly string[] {
    // Start with general version integrity
    const errors: string[] = [...verifyVersionIntegrity(history)];

    // Rollback-specific: ensure no version number was decremented
    for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1]!;
        const curr = history[i]!;

        if (curr.layoutVersion <= prev.layoutVersion) {
            errors.push(
                `Rollback violation at index ${i}: version must not decrement (v${prev.layoutVersion} → v${curr.layoutVersion})`,
            );
        }
    }

    // Ensure no version is reused across entire history
    const versionCounts = new Map<number, number>();
    for (const t of history) {
        versionCounts.set(t.layoutVersion, (versionCounts.get(t.layoutVersion) ?? 0) + 1);
    }
    for (const [version, count] of versionCounts.entries()) {
        if (count > 1) {
            errors.push(
                `Version ${version} appears ${count} times in history (must be unique)`,
            );
        }
    }

    return errors;
}
