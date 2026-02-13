// ─────────────────────────────────────────────
// ChronoVM Snapshot — Immutable State Clone
// ─────────────────────────────────────────────
// Deep clones VMState before each instruction.
// Snapshots are frozen after creation.
// ─────────────────────────────────────────────

import type { VMState } from '../vm/state.ts';

/**
 * An immutable snapshot of the VM state at a single point in time.
 * Structurally identical to VMState, but conceptually frozen.
 */
export type VMSnapshot = Readonly<VMState> & {
    readonly __snapshotBrand: true;
};

/**
 * Create an immutable deep clone of the current VMState.
 *
 * Uses structuredClone for correctness (preserves undefined,
 * unlike JSON.parse(JSON.stringify())).
 */
export function createSnapshot(state: VMState): VMSnapshot {
    const clone = structuredClone(state) as VMSnapshot;
    return Object.freeze(clone) as VMSnapshot;
}
