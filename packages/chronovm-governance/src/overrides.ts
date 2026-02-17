// ─────────────────────────────────────────────
// chronovm-governance — User Override & Merge
// ─────────────────────────────────────────────
// Pure functions for managing per-user panel overrides
// and resolving the final layout via 3-layer cascade,
// including version-aware rebase and offline conflict
// resolution. No mutation. No IO.
// ─────────────────────────────────────────────

import type { PanelId, PanelModeMap, ViewMode } from './roles.ts';
import { ALL_PANELS, DEFAULT_PANEL_MODES } from './roles.ts';
import type { ProjectTemplateLayout } from './template.ts';

// ── Override Entity ──

export interface UserLayoutOverride {
    readonly userId: string;
    readonly projectId: string;
    readonly baseVersion: number; // layoutVersion this was based on
    readonly overrides: Partial<Readonly<Record<PanelId, ViewMode>>>;
    readonly lastSyncedAt: string; // ISO8601
    readonly deviceId: string;
}

// ── Factory ──

/**
 * Create an empty override record for a user.
 */
export function createOverride(
    userId: string,
    projectId: string,
    baseVersion: number,
    deviceId: string,
    timestamp: string,
): UserLayoutOverride {
    return {
        userId,
        projectId,
        baseVersion,
        overrides: {},
        lastSyncedAt: timestamp,
        deviceId,
    };
}

// ── Modify Override ──

/**
 * Set a single panel override. Returns a new override record.
 * Rejects if the panel is locked in the template.
 */
export function setOverride(
    current: UserLayoutOverride,
    panelId: PanelId,
    mode: ViewMode,
    template: ProjectTemplateLayout,
    timestamp: string,
): { ok: true; override: UserLayoutOverride } | { ok: false; reason: string } {
    if (template.lockedPanels.includes(panelId)) {
        return { ok: false, reason: `Panel '${panelId}' is locked by the project template` };
    }

    return {
        ok: true,
        override: {
            ...current,
            overrides: { ...current.overrides, [panelId]: mode },
            lastSyncedAt: timestamp,
        },
    };
}

/**
 * Remove a single panel override (reset to template for that panel).
 */
export function clearOverride(
    current: UserLayoutOverride,
    panelId: PanelId,
    timestamp: string,
): UserLayoutOverride {
    const next = { ...current.overrides };
    delete next[panelId];
    return {
        ...current,
        overrides: next,
        lastSyncedAt: timestamp,
    };
}

/**
 * Reset all overrides (return to template defaults).
 */
export function clearAllOverrides(
    current: UserLayoutOverride,
    timestamp: string,
): UserLayoutOverride {
    return {
        ...current,
        overrides: {},
        lastSyncedAt: timestamp,
    };
}

// ── Version Comparison (Part 1) ──

/**
 * Describes the relationship between an override's baseVersion
 * and the template's layoutVersion.
 *
 * - 'current'  — override is on the same version as the template
 * - 'stale'    — override is behind the template (rebase needed)
 * - 'ahead'    — override claims a future version (invalid state)
 */
export type VersionComparison = 'current' | 'stale' | 'ahead';

/**
 * Compare override.baseVersion against template.layoutVersion.
 * Pure function — deterministic, no side effects.
 */
export function compareVersions(
    override: UserLayoutOverride,
    template: ProjectTemplateLayout,
): VersionComparison {
    if (override.baseVersion === template.layoutVersion) return 'current';
    if (override.baseVersion < template.layoutVersion) return 'stale';
    return 'ahead';
}

// ── Rebase Result (Part 4) ──

export interface RebaseResult {
    /** The rebased override record (new object, original is never mutated). */
    readonly override: UserLayoutOverride;
    /** True if the override was actually rebased (version bumped). */
    readonly rebased: boolean;
    /** PanelIds where overrides were dropped (locked or invalid). */
    readonly droppedPanels: readonly PanelId[];
    /** Version relationship that triggered (or skipped) the rebase. */
    readonly versionComparison: VersionComparison;
}

// ── Rebase on Template Update (Parts 2, 3, 7) ──

/**
 * Rebase user overrides after a template version bump.
 *
 * Rules:
 * - Locked panels: override dropped (but original record untouched).
 * - Unknown panelIds: override dropped (future-compat, Part 7).
 * - Invalid ViewMode values: override dropped (future-compat, Part 7).
 * - Unlocked + valid: override preserved.
 * - baseVersion bumped to template.layoutVersion.
 *
 * Non-destructive (Part 3): original override is never mutated.
 * Deterministic (Part 6): same inputs → same output, always.
 */
export function rebaseOverrides(
    current: UserLayoutOverride,
    newTemplate: ProjectTemplateLayout,
    timestamp: string,
): RebaseResult {
    const versionComparison = compareVersions(current, newTemplate);
    const dropped: PanelId[] = [];
    const rebased: Partial<Record<PanelId, ViewMode>> = {};

    for (const [panelId, mode] of Object.entries(current.overrides)) {
        const pid = panelId as PanelId;

        // Future-compat (Part 7): drop unknown panelIds
        if (!isValidPanelId(panelId)) {
            dropped.push(pid);
            continue;
        }

        // Future-compat (Part 7): drop invalid ViewMode values
        if (mode !== undefined && !isValidViewMode(mode as string)) {
            dropped.push(pid);
            continue;
        }

        // Lock enforcement (Part 2): drop overrides for locked panels
        if (newTemplate.lockedPanels.includes(pid)) {
            dropped.push(pid);
            continue;
        }

        // Unlocked + valid → keep
        rebased[pid] = mode;
    }

    return {
        override: {
            ...current,
            baseVersion: newTemplate.layoutVersion,
            overrides: rebased,
            lastSyncedAt: timestamp,
        },
        rebased: versionComparison !== 'current' || dropped.length > 0,
        droppedPanels: dropped,
        versionComparison,
    };
}

// ── Conflict Resolution (Part 5) ──

/**
 * Resolve conflicts when a user modified overrides offline
 * while the template was updated independently.
 *
 * Pipeline:
 *   1. Merge local + remote overrides (LWW per panel)
 *   2. Rebase merged result against new template
 *   3. Lock enforcement is automatic (rebase drops locked panels)
 *
 * Conflict rules:
 * - Locked panels: template always wins (regardless of timestamp)
 * - Unlocked panels: latest lastSyncedAt wins (LWW)
 *
 * Pure function — deterministic, no mutation, no IO.
 */
export function rebaseAndResolveConflict(
    localOverride: UserLayoutOverride,
    remoteOverride: UserLayoutOverride,
    template: ProjectTemplateLayout,
    timestamp: string,
): RebaseResult {
    // Step 1: LWW merge of the two device records
    const aIsNewer = localOverride.lastSyncedAt >= remoteOverride.lastSyncedAt;
    const primary = aIsNewer ? localOverride : remoteOverride;
    const secondary = aIsNewer ? remoteOverride : localOverride;

    const merged: Partial<Record<PanelId, ViewMode>> = {};
    for (const panelId of ALL_PANELS) {
        const pVal = primary.overrides[panelId];
        const sVal = secondary.overrides[panelId];
        if (pVal !== undefined) {
            merged[panelId] = pVal;
        } else if (sVal !== undefined) {
            merged[panelId] = sVal;
        }
    }

    const unifiedOverride: UserLayoutOverride = {
        userId: primary.userId,
        projectId: primary.projectId,
        baseVersion: Math.max(localOverride.baseVersion, remoteOverride.baseVersion),
        overrides: merged,
        lastSyncedAt: primary.lastSyncedAt,
        deviceId: primary.deviceId,
    };

    // Step 2: Rebase against the template (enforces locks + future-compat)
    return rebaseOverrides(unifiedOverride, template, timestamp);
}

// ── 3-Layer Merge Resolution ──

import { isValidPanelId, isValidViewMode } from './roles.ts';

// ── Merge Result Types ──

export type MergeWarningCode =
    | 'stale_override'
    | 'unknown_panel_dropped'
    | 'invalid_mode_dropped'
    | 'template_panel_missing';

export interface MergeWarning {
    readonly code: MergeWarningCode;
    readonly message: string;
}

export interface MergeResult {
    readonly layout: PanelModeMap;
    readonly warnings: readonly MergeWarning[];
    /** PanelIds where user overrides were dropped due to lock enforcement. */
    readonly droppedOverridePanelIds: readonly PanelId[];
}

// ── Input Validation ──

/**
 * Validate merge inputs and collect warnings.
 * Pure function — no side effects.
 */
export function validateMergeInputs(
    template: ProjectTemplateLayout | null,
    userOverride: UserLayoutOverride | null,
): readonly MergeWarning[] {
    const warnings: MergeWarning[] = [];

    // Check template panels completeness
    if (template) {
        for (const panelId of ALL_PANELS) {
            if (template.panelModes[panelId] === undefined) {
                warnings.push({
                    code: 'template_panel_missing',
                    message: `Template missing panel '${panelId}', will fill from system default`,
                });
            }
        }
    }

    // Check override freshness
    if (template && userOverride) {
        if (userOverride.baseVersion > template.layoutVersion) {
            warnings.push({
                code: 'stale_override',
                message: `Override baseVersion (${userOverride.baseVersion}) is ahead of template layoutVersion (${template.layoutVersion}), rebase recommended`,
            });
        }
    }

    // Check override keys and values
    if (userOverride) {
        for (const [key, value] of Object.entries(userOverride.overrides)) {
            if (!isValidPanelId(key)) {
                warnings.push({
                    code: 'unknown_panel_dropped',
                    message: `Override contains unknown panelId '${key}', will be dropped`,
                });
            } else if (value !== undefined && !isValidViewMode(value as string)) {
                warnings.push({
                    code: 'invalid_mode_dropped',
                    message: `Override for '${key}' has invalid ViewMode '${value}', will be dropped`,
                });
            }
        }
    }

    return warnings;
}

// ── Merge with Validation ──

/**
 * Detect which user override panels are dropped by lock enforcement.
 * Pure function — reads inputs only.
 */
function detectDroppedOverrides(
    template: ProjectTemplateLayout | null,
    userOverride: UserLayoutOverride | null,
): readonly PanelId[] {
    if (!template || !userOverride) return [];
    const dropped: PanelId[] = [];
    for (const key of Object.keys(userOverride.overrides)) {
        if (
            isValidPanelId(key) &&
            template.lockedPanels.includes(key as PanelId)
        ) {
            dropped.push(key as PanelId);
        }
    }
    return dropped;
}

/**
 * Resolve the final PanelModeMap with full input validation.
 * Returns the merged layout, sanitization warnings, and
 * a list of panelIds where user overrides were dropped
 * due to lock enforcement (for UI notification).
 *
 * droppedOverridePanelIds does NOT affect the layout —
 * it is purely informational metadata.
 *
 * Pure function — deterministic, no side effects.
 */
export function resolveLayoutWithValidation(
    template: ProjectTemplateLayout | null,
    userOverride: UserLayoutOverride | null,
): MergeResult {
    const warnings = validateMergeInputs(template, userOverride);
    const layout = resolveLayout(template, userOverride);
    const droppedOverridePanelIds = detectDroppedOverrides(template, userOverride);
    return { layout, warnings, droppedOverridePanelIds };
}

// ── Core 3-Layer Merge ──

/**
 * Resolve the final PanelModeMap by merging three layers:
 *
 *   Layer 1: SystemDefault (DEFAULT_PANEL_MODES)
 *   Layer 2: ProjectTemplateLayout
 *   Layer 3: UserOverrides (locked panels cannot be overridden)
 *
 * Sanitizes inputs: unknown panelIds and invalid ViewModes
 * in overrides are silently dropped. Missing template panels
 * are filled from system defaults.
 *
 * Pure function — deterministic output from inputs.
 */
export function resolveLayout(
    template: ProjectTemplateLayout | null,
    userOverride: UserLayoutOverride | null,
): PanelModeMap {
    const result: Record<PanelId, ViewMode> = {} as Record<PanelId, ViewMode>;

    for (const panelId of ALL_PANELS) {
        // Layer 1: System default
        let mode: ViewMode = DEFAULT_PANEL_MODES[panelId];

        // Layer 2: Project template (fill missing panels from default)
        if (template) {
            const templateMode = template.panelModes[panelId];
            if (templateMode !== undefined && isValidViewMode(templateMode as string)) {
                mode = templateMode;
            }
            // else: missing or invalid → stay on system default
        }

        // Layer 3: User override (unless locked)
        if (
            template &&
            template.lockedPanels.includes(panelId)
        ) {
            // Locked — template value is final, ignore user override
            result[panelId] = mode;
        } else if (
            userOverride &&
            userOverride.overrides[panelId] !== undefined
        ) {
            // Sanitize: only accept valid ViewMode values
            const overrideMode = userOverride.overrides[panelId]!;
            if (isValidViewMode(overrideMode as string)) {
                result[panelId] = overrideMode;
            } else {
                result[panelId] = mode; // invalid → fallback
            }
        } else {
            result[panelId] = mode;
        }
    }

    return result as PanelModeMap;
}

