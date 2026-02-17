// ─────────────────────────────────────────────
// chronovm-sync — Client-Side Reconciliation
// ─────────────────────────────────────────────
// Pure functions for desync detection, sequence
// validation, and render decision-making.
// No mutation. No IO. No network.
// ─────────────────────────────────────────────

import type { SyncStateMessage } from './protocol.ts';

// ── Client Sync State ──

export interface ClientSyncState {
    readonly lastReceivedSeq: number;
    readonly lastRenderedIndex: number;
    readonly lastServerTimestamp: number;
}

export const INITIAL_CLIENT_SYNC_STATE: ClientSyncState = {
    lastReceivedSeq: -1,
    lastRenderedIndex: 0,
    lastServerTimestamp: 0,
};

// ── Reconciliation Result ──

export type ReconcileAction =
    | { action: 'render'; index: number; newState: ClientSyncState }
    | { action: 'drop'; reason: string }
    | { action: 'request_full_sync'; reason: string; newState: ClientSyncState };

/**
 * Decide what to do when a SYNC_STATE message arrives.
 *
 * Rules:
 * 1. If seq ≤ lastReceivedSeq → DROP (stale or out-of-order)
 * 2. If seq > lastReceivedSeq + gapThreshold → REQUEST_FULL_SYNC
 * 3. Otherwise → RENDER at the new index
 *
 * Pure function — no side effects.
 */
export function reconcile(
    clientState: ClientSyncState,
    message: SyncStateMessage,
    gapThreshold: number = 5,
): ReconcileAction {
    // Stale / out-of-order
    if (message.sequenceNumber <= clientState.lastReceivedSeq) {
        return {
            action: 'drop',
            reason: `Stale message: seq ${message.sequenceNumber} ≤ last ${clientState.lastReceivedSeq}`,
        };
    }

    const newState: ClientSyncState = {
        lastReceivedSeq: message.sequenceNumber,
        lastRenderedIndex: message.currentMicroIndex,
        lastServerTimestamp: message.serverTimestamp,
    };

    // Large gap — might have missed intermediate messages
    if (message.sequenceNumber > clientState.lastReceivedSeq + gapThreshold) {
        return {
            action: 'request_full_sync',
            reason: `Gap detected: seq ${message.sequenceNumber} vs last ${clientState.lastReceivedSeq} (threshold: ${gapThreshold})`,
            newState,
        };
    }

    // Normal — render at the new index
    return {
        action: 'render',
        index: message.currentMicroIndex,
        newState,
    };
}

// ── Animation Hint ──

export type AnimationHint = 'step' | 'jump' | 'snap';

/**
 * Determine what animation to use based on the index delta.
 *
 * - step: smooth transition (delta = ±1)
 * - jump: crossfade (delta = ±2..10)
 * - snap: instant switch (delta > 10 or first render)
 */
export function animationHint(
    previousIndex: number,
    newIndex: number,
): AnimationHint {
    const delta = Math.abs(newIndex - previousIndex);
    if (delta <= 1) return 'step';
    if (delta <= 10) return 'jump';
    return 'snap';
}

// ── Deduplication ──

/**
 * Check whether a requestId has already been processed.
 * Pure — operates on a set-like structure.
 */
export function isDuplicate(
    processedIds: ReadonlySet<string>,
    requestId: string,
): boolean {
    return processedIds.has(requestId);
}

/**
 * Add a requestId and prune old entries beyond the max window.
 * Returns a new set (immutable).
 */
export function trackRequest(
    processedIds: ReadonlySet<string>,
    requestId: string,
    maxSize: number = 100,
): ReadonlySet<string> {
    const next = new Set(processedIds);
    next.add(requestId);

    // Prune if too large (FIFO — remove oldest entries)
    if (next.size > maxSize) {
        const iter = next.values();
        while (next.size > maxSize) {
            const oldest = iter.next().value;
            if (oldest !== undefined) {
                next.delete(oldest);
            }
        }
    }

    return next;
}
