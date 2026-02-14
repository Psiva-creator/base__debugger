// ─────────────────────────────────────────────
// ChronoVM Trace — Ordered Snapshot Collection
// ─────────────────────────────────────────────
// Append-only during execution.
// Immutable after runVM() returns.
// ─────────────────────────────────────────────

import type { VMSnapshot } from './snapshot';

/**
 * The complete execution trace — an ordered sequence of VM snapshots.
 * One snapshot is captured BEFORE each instruction executes.
 */
export type ExecutionTrace = {
    readonly snapshots: VMSnapshot[];
};

/**
 * Create an empty trace.
 */
export function createTrace(): ExecutionTrace {
    return { snapshots: [] };
}

/**
 * Append a snapshot to the trace.
 * Only valid during execution (before trace is sealed).
 */
export function appendSnapshot(trace: ExecutionTrace, snapshot: VMSnapshot): void {
    (trace.snapshots as VMSnapshot[]).push(snapshot);
}

/**
 * Seal the trace — returns a frozen copy.
 * After sealing, no more snapshots can be appended.
 */
export function sealTrace(trace: ExecutionTrace): Readonly<ExecutionTrace> {
    return Object.freeze({
        snapshots: Object.freeze([...trace.snapshots]) as unknown as VMSnapshot[],
    });
}
