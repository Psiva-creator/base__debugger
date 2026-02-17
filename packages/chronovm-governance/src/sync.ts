// ─────────────────────────────────────────────
// chronovm-governance — Multi-Device Sync
// ─────────────────────────────────────────────
// Pure conflict resolution for user overrides
// across multiple devices. Last-write-wins per panel.
// No mutation. No IO. No network.
// ─────────────────────────────────────────────

import type { PanelId, ViewMode } from './roles.ts';
import { ALL_PANELS } from './roles.ts';
import type { UserLayoutOverride } from './overrides.ts';

// ── Conflict Resolution ──

/**
 * Merge two UserLayoutOverride records from different devices.
 * Uses Last-Write-Wins per panel: the override with the later
 * `lastSyncedAt` wins for each panel.
 *
 * For panels where only one device has an override, that override
 * is kept unconditionally.
 *
 * Returns a unified override record.
 */
export function mergeOverrides(
    a: UserLayoutOverride,
    b: UserLayoutOverride,
): UserLayoutOverride {
    // Basic identity checks
    if (a.userId !== b.userId || a.projectId !== b.projectId) {
        throw new Error('Cannot merge overrides from different users or projects');
    }

    const aIsNewer = a.lastSyncedAt >= b.lastSyncedAt;
    const primary = aIsNewer ? a : b;
    const secondary = aIsNewer ? b : a;

    // Merge panel-by-panel
    const merged: Partial<Record<PanelId, ViewMode>> = {};

    for (const panelId of ALL_PANELS) {
        const aVal = a.overrides[panelId];
        const bVal = b.overrides[panelId];

        if (aVal !== undefined && bVal !== undefined) {
            // Both have override — LWW: primary (newer) wins
            merged[panelId] = primary.overrides[panelId]!;
        } else if (aVal !== undefined) {
            merged[panelId] = aVal;
        } else if (bVal !== undefined) {
            merged[panelId] = bVal;
        }
        // Neither has override — skip
    }

    return {
        userId: primary.userId,
        projectId: primary.projectId,
        baseVersion: Math.max(a.baseVersion, b.baseVersion),
        overrides: merged,
        lastSyncedAt: primary.lastSyncedAt,
        deviceId: primary.deviceId,
    };
}

// ── Sync Status ──

export interface SyncStatus {
    readonly inSync: boolean;
    readonly divergedPanels: readonly PanelId[];
}

/**
 * Compare two override records and report which panels diverge.
 * Useful for displaying sync status in UI.
 */
export function compareSyncState(
    a: UserLayoutOverride,
    b: UserLayoutOverride,
): SyncStatus {
    const diverged: PanelId[] = [];

    for (const panelId of ALL_PANELS) {
        const aVal = a.overrides[panelId];
        const bVal = b.overrides[panelId];
        if (aVal !== bVal) {
            diverged.push(panelId);
        }
    }

    return {
        inSync: diverged.length === 0,
        divergedPanels: diverged,
    };
}
