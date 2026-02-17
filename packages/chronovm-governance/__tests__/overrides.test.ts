// ─────────────────────────────────────────────
// Tests — User Overrides & Merge Resolution
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    createOverride,
    setOverride,
    clearOverride,
    clearAllOverrides,
    rebaseOverrides,
    resolveLayout,
} from '../src/overrides.ts';
import { createTemplate } from '../src/template.ts';
import { DEFAULT_PANEL_MODES } from '../src/roles.ts';
import type { ProjectTemplateLayout } from '../src/template.ts';
import type { UserLayoutOverride } from '../src/overrides.ts';

const TS = '2026-01-01T00:00:00Z';

function makeTemplate(overrides?: Partial<ProjectTemplateLayout>): ProjectTemplateLayout {
    return { ...createTemplate('proj1', 'owner1', TS), ...overrides };
}

function makeOverription(overrides?: Partial<UserLayoutOverride>): UserLayoutOverride {
    return { ...createOverride('user1', 'proj1', 1, 'device-a', TS), ...overrides };
}

describe('createOverride', () => {
    it('creates an empty override', () => {
        const o = createOverride('user1', 'proj1', 1, 'device-a', TS);
        expect(o.overrides).toEqual({});
        expect(o.baseVersion).toBe(1);
    });
});

describe('setOverride', () => {
    it('sets a panel override', () => {
        const o = makeOverription();
        const t = makeTemplate();
        const result = setOverride(o, 'memory', 'pro', t, TS);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.override.overrides.memory).toBe('pro');
        }
    });

    it('rejects override on locked panel', () => {
        const o = makeOverription();
        const t = makeTemplate({ lockedPanels: ['memory'] });
        const result = setOverride(o, 'memory', 'pro', t, TS);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('locked');
        }
    });

    it('allows override on unlocked panel when others are locked', () => {
        const o = makeOverription();
        const t = makeTemplate({ lockedPanels: ['memory'] });
        const result = setOverride(o, 'stack', 'pro', t, TS);
        expect(result.ok).toBe(true);
    });

    it('does not mutate original override', () => {
        const o = makeOverription();
        const original = { ...o, overrides: { ...o.overrides } };
        const t = makeTemplate();
        setOverride(o, 'memory', 'pro', t, TS);
        expect(o).toEqual(original);
    });
});

describe('clearOverride', () => {
    it('removes a single panel override', () => {
        const o = makeOverription({ overrides: { memory: 'pro', stack: 'pro' } });
        const result = clearOverride(o, 'memory', TS);
        expect(result.overrides.memory).toBeUndefined();
        expect(result.overrides.stack).toBe('pro');
    });
});

describe('clearAllOverrides', () => {
    it('removes all overrides', () => {
        const o = makeOverription({ overrides: { memory: 'pro', stack: 'pro' } });
        const result = clearAllOverrides(o, TS);
        expect(result.overrides).toEqual({});
    });
});

describe('rebaseOverrides', () => {
    it('preserves overrides for unlocked panels', () => {
        const o = makeOverription({ overrides: { memory: 'pro', stack: 'pro' } });
        const t = makeTemplate({ layoutVersion: 2, lockedPanels: [] });
        const { override, droppedPanels } = rebaseOverrides(o, t, TS);
        expect(override.overrides.memory).toBe('pro');
        expect(override.overrides.stack).toBe('pro');
        expect(override.baseVersion).toBe(2);
        expect(droppedPanels).toEqual([]);
    });

    it('drops overrides for newly locked panels', () => {
        const o = makeOverription({ overrides: { memory: 'pro', stack: 'pro' } });
        const t = makeTemplate({ layoutVersion: 2, lockedPanels: ['memory'] });
        const { override, droppedPanels } = rebaseOverrides(o, t, TS);
        expect(override.overrides.memory).toBeUndefined();
        expect(override.overrides.stack).toBe('pro');
        expect(droppedPanels).toEqual(['memory']);
    });
});

describe('resolveLayout', () => {
    it('returns system defaults with no template or override', () => {
        const result = resolveLayout(null, null);
        expect(result).toEqual(DEFAULT_PANEL_MODES);
    });

    it('template overrides system defaults', () => {
        const t = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
        });
        const result = resolveLayout(t, null);
        expect(result.memory).toBe('pro');
        expect(result.stack).toBe('learning');
    });

    it('user override beats template for unlocked panel', () => {
        const t = makeTemplate();
        const o = makeOverription({ overrides: { memory: 'pro' } });
        const result = resolveLayout(t, o);
        expect(result.memory).toBe('pro');
    });

    it('locked panel ignores user override', () => {
        const t = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'learning' },
            lockedPanels: ['memory'],
        });
        const o = makeOverription({ overrides: { memory: 'pro' } });
        const result = resolveLayout(t, o);
        expect(result.memory).toBe('learning'); // locked wins
    });

    it('non-locked panels still accept overrides when some are locked', () => {
        const t = makeTemplate({ lockedPanels: ['memory'] });
        const o = makeOverription({ overrides: { memory: 'pro', stack: 'pro' } });
        const result = resolveLayout(t, o);
        expect(result.memory).toBe('learning'); // locked
        expect(result.stack).toBe('pro'); // override wins
    });

    it('returns same result for same inputs (deterministic)', () => {
        const t = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['narration'],
        });
        const o = makeOverription({ overrides: { stack: 'pro', narration: 'pro' } });
        const a = resolveLayout(t, o);
        const b = resolveLayout(t, o);
        expect(a).toEqual(b);
    });
});
