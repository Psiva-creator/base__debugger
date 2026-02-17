// ─────────────────────────────────────────────
// Tests — Rebase Logic (7-Part Spec)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    compareVersions,
    rebaseOverrides,
    rebaseAndResolveConflict,
    resolveLayout,
    createOverride,
    createTemplate,
} from '../src/index.ts';
import { ALL_PANELS, DEFAULT_PANEL_MODES } from '../src/roles.ts';
import type { PanelId, ViewMode } from '../src/roles.ts';
import type { ProjectTemplateLayout } from '../src/template.ts';
import type { UserLayoutOverride, RebaseResult } from '../src/overrides.ts';

// ── Helpers ──

function makeTemplate(overrides: Partial<ProjectTemplateLayout> = {}): ProjectTemplateLayout {
    return { ...createTemplate('p1', 'u1', '2026-01-01T00:00:00Z'), ...overrides };
}

function makeOverride(overrides: Partial<UserLayoutOverride> = {}): UserLayoutOverride {
    return { ...createOverride('u1', 'p1', 1, 'd1', '2026-01-01T00:00:00Z'), ...overrides };
}

const TS = '2026-02-01T00:00:00Z';

// ═══════════════════════════════════════════════════
// Part 1 — Version Comparison
// ═══════════════════════════════════════════════════

describe('Part 1: compareVersions', () => {
    it('returns "current" when baseVersion == layoutVersion', () => {
        const override = makeOverride({ baseVersion: 3 });
        const template = makeTemplate({ layoutVersion: 3 });
        expect(compareVersions(override, template)).toBe('current');
    });

    it('returns "stale" when baseVersion < layoutVersion', () => {
        const override = makeOverride({ baseVersion: 1 });
        const template = makeTemplate({ layoutVersion: 5 });
        expect(compareVersions(override, template)).toBe('stale');
    });

    it('returns "ahead" when baseVersion > layoutVersion (invalid state)', () => {
        const override = makeOverride({ baseVersion: 10 });
        const template = makeTemplate({ layoutVersion: 3 });
        expect(compareVersions(override, template)).toBe('ahead');
    });

    it('returns "current" for version 1 == 1', () => {
        const override = makeOverride({ baseVersion: 1 });
        const template = makeTemplate({ layoutVersion: 1 });
        expect(compareVersions(override, template)).toBe('current');
    });

    it('is a pure function — same inputs always same output', () => {
        const override = makeOverride({ baseVersion: 2 });
        const template = makeTemplate({ layoutVersion: 5 });
        const a = compareVersions(override, template);
        const b = compareVersions(override, template);
        expect(a).toBe(b);
    });
});

// ═══════════════════════════════════════════════════
// Part 2 — Rebase Rules
// ═══════════════════════════════════════════════════

describe('Part 2: rebase rules', () => {
    it('keeps override for unlocked panel', () => {
        const override = makeOverride({ overrides: { memory: 'pro', stack: 'pro' } });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: [] });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.overrides.memory).toBe('pro');
        expect(result.override.overrides.stack).toBe('pro');
    });

    it('drops override for newly locked panel', () => {
        const override = makeOverride({ overrides: { memory: 'pro', stack: 'pro' } });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: ['memory'] });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.overrides.memory).toBeUndefined();
        expect(result.override.overrides.stack).toBe('pro');
        expect(result.droppedPanels).toContain('memory');
    });

    it('drops overrides for all locked panels', () => {
        const override = makeOverride({
            overrides: { memory: 'pro', stack: 'pro', output: 'pro' },
        });
        const template = makeTemplate({
            layoutVersion: 2,
            lockedPanels: ['memory', 'stack', 'output'],
        });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.overrides).toEqual({});
        expect(result.droppedPanels).toEqual(expect.arrayContaining(['memory', 'stack', 'output']));
    });

    it('new panel in template with no override → cascade applies normally', () => {
        // No override for 'narration' — resolveLayout fills from cascade
        const override = makeOverride({ overrides: { memory: 'pro' } });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.overrides.narration).toBeUndefined();
        // Verify cascade fills it
        const layout = resolveLayout(template, result.override);
        expect(layout.narration).toBe('learning'); // system default
    });

    it('bumps baseVersion to template.layoutVersion', () => {
        const override = makeOverride({ baseVersion: 1 });
        const template = makeTemplate({ layoutVersion: 7 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.baseVersion).toBe(7);
    });

    it('updates lastSyncedAt to provided timestamp', () => {
        const override = makeOverride();
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseOverrides(override, template, '2026-03-15T12:00:00Z');
        expect(result.override.lastSyncedAt).toBe('2026-03-15T12:00:00Z');
    });
});

// ═══════════════════════════════════════════════════
// Part 3 — Non-destructive Rule
// ═══════════════════════════════════════════════════

describe('Part 3: non-destructive', () => {
    it('does not mutate original override record', () => {
        const override = makeOverride({ overrides: { memory: 'pro', stack: 'pro' } });
        const snap = JSON.stringify(override);
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: ['memory'] });
        rebaseOverrides(override, template, TS);
        expect(JSON.stringify(override)).toBe(snap);
    });

    it('does not mutate the template', () => {
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: ['memory'] });
        const snap = JSON.stringify(template);
        rebaseOverrides(makeOverride({ overrides: { memory: 'pro' } }), template, TS);
        expect(JSON.stringify(template)).toBe(snap);
    });

    it('returns a new override object (not the same reference)', () => {
        const override = makeOverride({ overrides: { memory: 'pro' } });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override).not.toBe(override);
    });

    it('original override still has locked panel values after rebase', () => {
        const override = makeOverride({ overrides: { memory: 'pro' } });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: ['memory'] });
        rebaseOverrides(override, template, TS);
        expect(override.overrides.memory).toBe('pro'); // untouched
    });
});

// ═══════════════════════════════════════════════════
// Part 4 — Override Dropping Metadata
// ═══════════════════════════════════════════════════

describe('Part 4: rebase metadata', () => {
    it('rebased=true when version changes', () => {
        const override = makeOverride({ baseVersion: 1 });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.rebased).toBe(true);
    });

    it('rebased=true when panels are dropped even on same version', () => {
        const override = makeOverride({
            baseVersion: 2,
            overrides: { memory: 'pro' },
        });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: ['memory'] });
        const result = rebaseOverrides(override, template, TS);
        expect(result.rebased).toBe(true);
        expect(result.droppedPanels).toContain('memory');
    });

    it('rebased=false when current and no drops', () => {
        const override = makeOverride({ baseVersion: 2, overrides: { memory: 'pro' } });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: [] });
        const result = rebaseOverrides(override, template, TS);
        expect(result.rebased).toBe(false);
    });

    it('droppedPanels lists all dropped panel IDs', () => {
        const override = makeOverride({
            overrides: { memory: 'pro', stack: 'pro', output: 'pro' },
        });
        const template = makeTemplate({
            layoutVersion: 2,
            lockedPanels: ['memory', 'output'],
        });
        const result = rebaseOverrides(override, template, TS);
        expect(result.droppedPanels).toContain('memory');
        expect(result.droppedPanels).toContain('output');
        expect(result.droppedPanels).not.toContain('stack');
    });

    it('versionComparison reflects stale state', () => {
        const override = makeOverride({ baseVersion: 1 });
        const template = makeTemplate({ layoutVersion: 5 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.versionComparison).toBe('stale');
    });

    it('versionComparison reflects ahead (invalid) state', () => {
        const override = makeOverride({ baseVersion: 10 });
        const template = makeTemplate({ layoutVersion: 3 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.versionComparison).toBe('ahead');
    });
});

// ═══════════════════════════════════════════════════
// Part 5 — Conflict Safety (offline / reconnect)
// ═══════════════════════════════════════════════════

describe('Part 5: rebaseAndResolveConflict', () => {
    it('merges non-overlapping overrides from two devices', () => {
        const local = makeOverride({
            overrides: { memory: 'pro' },
            lastSyncedAt: '2026-01-01T01:00:00Z',
            deviceId: 'device-a',
        });
        const remote = makeOverride({
            overrides: { stack: 'pro' },
            lastSyncedAt: '2026-01-01T00:30:00Z',
            deviceId: 'device-b',
        });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: [] });
        const result = rebaseAndResolveConflict(local, remote, template, TS);
        expect(result.override.overrides.memory).toBe('pro');
        expect(result.override.overrides.stack).toBe('pro');
    });

    it('LWW: newer device wins for conflicting panel', () => {
        const local = makeOverride({
            overrides: { memory: 'learning' },
            lastSyncedAt: '2026-01-01T01:00:00Z',
            deviceId: 'device-a',
        });
        const remote = makeOverride({
            overrides: { memory: 'pro' },
            lastSyncedAt: '2026-01-01T02:00:00Z', // newer
            deviceId: 'device-b',
        });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: [] });
        const result = rebaseAndResolveConflict(local, remote, template, TS);
        expect(result.override.overrides.memory).toBe('pro'); // remote wins
    });

    it('template locks always win over LWW', () => {
        const local = makeOverride({
            overrides: { memory: 'pro' },
            lastSyncedAt: '2026-01-01T03:00:00Z', // very new
            deviceId: 'device-a',
        });
        const remote = makeOverride({
            overrides: { memory: 'learning' },
            lastSyncedAt: '2026-01-01T01:00:00Z',
            deviceId: 'device-b',
        });
        const template = makeTemplate({
            layoutVersion: 2,
            lockedPanels: ['memory'],
        });
        const result = rebaseAndResolveConflict(local, remote, template, TS);
        expect(result.override.overrides.memory).toBeUndefined(); // dropped by lock
        expect(result.droppedPanels).toContain('memory');
        // Resolve layout — template value wins
        const layout = resolveLayout(template, result.override);
        expect(layout.memory).toBe('learning'); // template default
    });

    it('latest timestamp wins for unlocked conflicting panels', () => {
        const local = makeOverride({
            overrides: { stack: 'learning' },
            lastSyncedAt: '2026-01-01T05:00:00Z', // newer
            deviceId: 'device-a',
        });
        const remote = makeOverride({
            overrides: { stack: 'pro' },
            lastSyncedAt: '2026-01-01T01:00:00Z',
            deviceId: 'device-b',
        });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: [] });
        const result = rebaseAndResolveConflict(local, remote, template, TS);
        expect(result.override.overrides.stack).toBe('learning'); // local wins (newer)
    });

    it('uses higher baseVersion from both overrides', () => {
        const local = makeOverride({ baseVersion: 3, deviceId: 'device-a' });
        const remote = makeOverride({ baseVersion: 5, deviceId: 'device-b' });
        const template = makeTemplate({ layoutVersion: 6 });
        const result = rebaseAndResolveConflict(local, remote, template, TS);
        // After rebase, baseVersion should be template.layoutVersion
        expect(result.override.baseVersion).toBe(6);
    });

    it('does not mutate local or remote overrides', () => {
        const local = makeOverride({
            overrides: { memory: 'pro' },
            deviceId: 'device-a',
        });
        const remote = makeOverride({
            overrides: { stack: 'pro' },
            deviceId: 'device-b',
        });
        const snapLocal = JSON.stringify(local);
        const snapRemote = JSON.stringify(remote);
        const template = makeTemplate({ layoutVersion: 2 });
        rebaseAndResolveConflict(local, remote, template, TS);
        expect(JSON.stringify(local)).toBe(snapLocal);
        expect(JSON.stringify(remote)).toBe(snapRemote);
    });

    it('handles both empty overrides', () => {
        const local = makeOverride({ deviceId: 'device-a' });
        const remote = makeOverride({ deviceId: 'device-b' });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseAndResolveConflict(local, remote, template, TS);
        expect(result.override.overrides).toEqual({});
        expect(result.droppedPanels).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════
// Part 6 — Determinism Guarantee
// ═══════════════════════════════════════════════════

describe('Part 6: determinism', () => {
    it('same inputs → same rebase output over 1000 iterations', () => {
        const override = makeOverride({
            overrides: { memory: 'pro', stack: 'pro' },
        });
        const template = makeTemplate({
            layoutVersion: 3,
            lockedPanels: ['memory'],
        });
        const baseline = rebaseOverrides(override, template, TS);
        for (let i = 0; i < 1000; i++) {
            const result = rebaseOverrides(override, template, TS);
            expect(result).toEqual(baseline);
        }
    });

    it('same conflict inputs → same conflict output over 1000 iterations', () => {
        const local = makeOverride({
            overrides: { memory: 'pro' },
            lastSyncedAt: '2026-01-01T02:00:00Z',
            deviceId: 'device-a',
        });
        const remote = makeOverride({
            overrides: { memory: 'learning', stack: 'pro' },
            lastSyncedAt: '2026-01-01T01:00:00Z',
            deviceId: 'device-b',
        });
        const template = makeTemplate({
            layoutVersion: 2,
            lockedPanels: ['stack'],
        });
        const baseline = rebaseAndResolveConflict(local, remote, template, TS);
        for (let i = 0; i < 1000; i++) {
            expect(rebaseAndResolveConflict(local, remote, template, TS)).toEqual(baseline);
        }
    });

    it('rebase does not reorder panels in output', () => {
        const override = makeOverride({
            overrides: { output: 'pro', memory: 'pro' },
        });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseOverrides(override, template, TS);
        // After rebase, resolveLayout should still have canonical order
        const layout = resolveLayout(template, result.override);
        expect(Object.keys(layout)).toEqual([...ALL_PANELS]);
    });

    it('compareVersions is deterministic', () => {
        const override = makeOverride({ baseVersion: 2 });
        const template = makeTemplate({ layoutVersion: 5 });
        const results = new Set<string>();
        for (let i = 0; i < 100; i++) {
            results.add(compareVersions(override, template));
        }
        expect(results.size).toBe(1);
        expect(results.has('stale')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════
// Part 7 — Future Compatibility
// ═══════════════════════════════════════════════════

describe('Part 7: future compatibility', () => {
    it('unknown panelId in override is filtered out during rebase', () => {
        const override = makeOverride({
            overrides: { memory: 'pro', futurePanel: 'pro' } as any,
        });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.overrides.memory).toBe('pro');
        expect((result.override.overrides as any).futurePanel).toBeUndefined();
        expect(result.droppedPanels).toContain('futurePanel');
    });

    it('invalid ViewMode in override is filtered out during rebase', () => {
        const override = makeOverride({
            overrides: { memory: 'compact' as any },
        });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.overrides.memory).toBeUndefined();
        expect(result.droppedPanels).toContain('memory');
    });

    it('valid panels with valid modes pass through rebase unchanged', () => {
        const override = makeOverride({
            overrides: { memory: 'pro', stack: 'learning', output: 'pro' },
        });
        const template = makeTemplate({ layoutVersion: 2, lockedPanels: [] });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.overrides.memory).toBe('pro');
        expect(result.override.overrides.stack).toBe('learning');
        expect(result.override.overrides.output).toBe('pro');
        expect(result.droppedPanels).toEqual([]);
    });

    it('multiple unknown panels and invalid modes all filtered', () => {
        const override = makeOverride({
            overrides: {
                memory: 'pro',
                unknownA: 'pro',
                stack: 'superMode',
                unknownB: 'learning',
            } as any,
        });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseOverrides(override, template, TS);
        expect(result.override.overrides.memory).toBe('pro');
        expect((result.override.overrides as any).unknownA).toBeUndefined();
        expect(result.override.overrides.stack).toBeUndefined(); // invalid mode
        expect((result.override.overrides as any).unknownB).toBeUndefined();
        expect(result.droppedPanels).toContain('unknownA');
        expect(result.droppedPanels).toContain('stack');
        expect(result.droppedPanels).toContain('unknownB');
    });

    it('conflict resolution also filters unknowns', () => {
        const local = makeOverride({
            overrides: { memory: 'pro', futurePanel: 'pro' } as any,
            lastSyncedAt: '2026-01-01T02:00:00Z',
            deviceId: 'device-a',
        });
        const remote = makeOverride({
            overrides: { stack: 'pro' },
            lastSyncedAt: '2026-01-01T01:00:00Z',
            deviceId: 'device-b',
        });
        const template = makeTemplate({ layoutVersion: 2 });
        const result = rebaseAndResolveConflict(local, remote, template, TS);
        expect(result.override.overrides.memory).toBe('pro');
        expect(result.override.overrides.stack).toBe('pro');
        // futurePanel not in ALL_PANELS → not merged by the LWW loop
        // (LWW iterates ALL_PANELS only)
        expect((result.override.overrides as any).futurePanel).toBeUndefined();
    });
});
