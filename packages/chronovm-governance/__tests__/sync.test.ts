// ─────────────────────────────────────────────
// Tests — Multi-Device Sync
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { mergeOverrides, compareSyncState } from '../src/sync.ts';
import { createOverride } from '../src/overrides.ts';
import type { UserLayoutOverride } from '../src/overrides.ts';

function makeOvr(overrides: Partial<UserLayoutOverride>): UserLayoutOverride {
    return {
        ...createOverride('user1', 'proj1', 1, 'device-a', '2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

describe('mergeOverrides', () => {
    it('merges when only one device has override', () => {
        const a = makeOvr({ overrides: { memory: 'pro' }, lastSyncedAt: '2026-01-01T01:00:00Z' });
        const b = makeOvr({ overrides: { stack: 'pro' }, lastSyncedAt: '2026-01-01T00:30:00Z', deviceId: 'device-b' });
        const result = mergeOverrides(a, b);
        expect(result.overrides.memory).toBe('pro');
        expect(result.overrides.stack).toBe('pro');
    });

    it('LWW: newer device wins for conflicting panel', () => {
        const a = makeOvr({
            overrides: { memory: 'learning' },
            lastSyncedAt: '2026-01-01T01:00:00Z',
            deviceId: 'device-a',
        });
        const b = makeOvr({
            overrides: { memory: 'pro' },
            lastSyncedAt: '2026-01-01T02:00:00Z', // newer
            deviceId: 'device-b',
        });
        const result = mergeOverrides(a, b);
        expect(result.overrides.memory).toBe('pro'); // b wins
    });

    it('uses higher baseVersion', () => {
        const a = makeOvr({ baseVersion: 3 });
        const b = makeOvr({ baseVersion: 5, deviceId: 'device-b' });
        const result = mergeOverrides(a, b);
        expect(result.baseVersion).toBe(5);
    });

    it('throws on mismatched userId', () => {
        const a = makeOvr({});
        const b = makeOvr({ userId: 'user2', deviceId: 'device-b' });
        expect(() => mergeOverrides(a, b)).toThrow();
    });

    it('throws on mismatched projectId', () => {
        const a = makeOvr({});
        const b = makeOvr({ projectId: 'proj2', deviceId: 'device-b' });
        expect(() => mergeOverrides(a, b)).toThrow();
    });

    it('handles both empty overrides', () => {
        const a = makeOvr({ deviceId: 'device-a' });
        const b = makeOvr({ deviceId: 'device-b' });
        const result = mergeOverrides(a, b);
        expect(result.overrides).toEqual({});
    });
});

describe('compareSyncState', () => {
    it('reports in-sync when identical', () => {
        const a = makeOvr({ overrides: { memory: 'pro' } });
        const b = makeOvr({ overrides: { memory: 'pro' }, deviceId: 'device-b' });
        const status = compareSyncState(a, b);
        expect(status.inSync).toBe(true);
        expect(status.divergedPanels).toEqual([]);
    });

    it('reports diverged panels', () => {
        const a = makeOvr({ overrides: { memory: 'pro' } });
        const b = makeOvr({ overrides: { memory: 'learning' }, deviceId: 'device-b' });
        const status = compareSyncState(a, b);
        expect(status.inSync).toBe(false);
        expect(status.divergedPanels).toContain('memory');
    });

    it('detects divergence when one has override and other does not', () => {
        const a = makeOvr({ overrides: { memory: 'pro' } });
        const b = makeOvr({ overrides: {}, deviceId: 'device-b' });
        const status = compareSyncState(a, b);
        expect(status.inSync).toBe(false);
        expect(status.divergedPanels).toContain('memory');
    });
});
