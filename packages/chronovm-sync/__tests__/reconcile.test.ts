// ─────────────────────────────────────────────
// Tests — Reconciliation
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    reconcile,
    animationHint,
    isDuplicate,
    trackRequest,
    INITIAL_CLIENT_SYNC_STATE,
} from '../src/reconcile.ts';
import { createSyncStateMessage } from '../src/protocol.ts';

describe('reconcile', () => {
    it('renders on normal sync message', () => {
        const msg = createSyncStateMessage(5, 'paused', 1, 1000, 1);
        const result = reconcile(INITIAL_CLIENT_SYNC_STATE, msg);
        expect(result.action).toBe('render');
        if (result.action === 'render') {
            expect(result.index).toBe(5);
            expect(result.newState.lastReceivedSeq).toBe(1);
        }
    });

    it('drops stale message', () => {
        const state = { ...INITIAL_CLIENT_SYNC_STATE, lastReceivedSeq: 10 };
        const msg = createSyncStateMessage(5, 'paused', 1, 1000, 8);
        const result = reconcile(state, msg);
        expect(result.action).toBe('drop');
    });

    it('drops message with same seq', () => {
        const state = { ...INITIAL_CLIENT_SYNC_STATE, lastReceivedSeq: 5 };
        const msg = createSyncStateMessage(10, 'paused', 1, 1000, 5);
        const result = reconcile(state, msg);
        expect(result.action).toBe('drop');
    });

    it('requests full sync on large gap', () => {
        const state = { ...INITIAL_CLIENT_SYNC_STATE, lastReceivedSeq: 1 };
        const msg = createSyncStateMessage(50, 'playing', 5, 2000, 20);
        const result = reconcile(state, msg, 5);
        expect(result.action).toBe('request_full_sync');
    });

    it('renders on small gap within threshold', () => {
        const state = { ...INITIAL_CLIENT_SYNC_STATE, lastReceivedSeq: 1 };
        const msg = createSyncStateMessage(5, 'paused', 1, 1000, 4);
        const result = reconcile(state, msg, 5);
        expect(result.action).toBe('render');
    });

    it('updates client state after render', () => {
        const msg = createSyncStateMessage(42, 'playing', 3, 5000, 10);
        const result = reconcile(INITIAL_CLIENT_SYNC_STATE, msg);
        if (result.action === 'render') {
            expect(result.newState.lastReceivedSeq).toBe(10);
            expect(result.newState.lastRenderedIndex).toBe(42);
            expect(result.newState.lastServerTimestamp).toBe(5000);
        }
    });
});

describe('animationHint', () => {
    it('returns step for delta 0', () => {
        expect(animationHint(5, 5)).toBe('step');
    });

    it('returns step for delta 1', () => {
        expect(animationHint(5, 6)).toBe('step');
    });

    it('returns jump for delta 2-10', () => {
        expect(animationHint(5, 10)).toBe('jump');
        expect(animationHint(10, 5)).toBe('jump');
    });

    it('returns snap for delta > 10', () => {
        expect(animationHint(0, 50)).toBe('snap');
    });
});

describe('isDuplicate', () => {
    it('returns false for new id', () => {
        expect(isDuplicate(new Set(), 'req-1')).toBe(false);
    });

    it('returns true for existing id', () => {
        expect(isDuplicate(new Set(['req-1']), 'req-1')).toBe(true);
    });
});

describe('trackRequest', () => {
    it('adds new request id', () => {
        const result = trackRequest(new Set(), 'req-1');
        expect(result.has('req-1')).toBe(true);
    });

    it('prunes when exceeding maxSize', () => {
        let set: ReadonlySet<string> = new Set();
        for (let i = 0; i < 10; i++) {
            set = trackRequest(set, `req-${i}`, 5);
        }
        expect(set.size).toBeLessThanOrEqual(5);
        // Most recent should be kept
        expect(set.has('req-9')).toBe(true);
    });
});
