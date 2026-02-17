// ─────────────────────────────────────────────
// Tests — Locked Panel Enforcement
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    resolveLayout,
    resolveLayoutWithValidation,
    createOverride,
    createTemplate,
} from '../src/index.ts';
import { ALL_PANELS, DEFAULT_PANEL_MODES } from '../src/roles.ts';
import type { PanelId, PanelModeMap } from '../src/roles.ts';
import type { ProjectTemplateLayout } from '../src/template.ts';
import type { UserLayoutOverride } from '../src/overrides.ts';

// ── Helpers ──

function makeTemplate(overrides: Partial<ProjectTemplateLayout> = {}): ProjectTemplateLayout {
    return { ...createTemplate('p1', 'u1', '2026-01-01T00:00:00Z'), ...overrides };
}

function makeOverride(overrides: Partial<UserLayoutOverride> = {}): UserLayoutOverride {
    return { ...createOverride('u1', 'p1', 1, 'd1', '2026-01-01T00:00:00Z'), ...overrides };
}

// ═══════════════════════════════════════════════════
// Part 1 — Locked panel definition
// ═══════════════════════════════════════════════════

describe('Lock definition', () => {
    it('locked panel uses template value', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['memory'],
        });
        expect(resolveLayout(template, null).memory).toBe('pro');
    });

    it('unlocked panel uses system default when no override', () => {
        const template = makeTemplate({ lockedPanels: ['memory'] });
        expect(resolveLayout(template, null).stack).toBe('learning');
    });

    it('empty lockedPanels array means nothing is locked', () => {
        const template = makeTemplate({ lockedPanels: [] });
        const override = makeOverride({ overrides: { memory: 'pro' } });
        expect(resolveLayout(template, override).memory).toBe('pro');
    });
});

// ═══════════════════════════════════════════════════
// Part 2 — Enforcement priority
// ═══════════════════════════════════════════════════

describe('Enforcement priority', () => {
    it('locked panel ignores user override', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['memory'],
        });
        const override = makeOverride({ overrides: { memory: 'learning' } });
        expect(resolveLayout(template, override).memory).toBe('pro');
    });

    it('unlocked panel accepts user override', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, stack: 'learning' },
            lockedPanels: ['memory'],
        });
        const override = makeOverride({ overrides: { stack: 'pro' } });
        expect(resolveLayout(template, override).stack).toBe('pro');
    });

    it('multiple locked panels all enforced simultaneously', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro', stack: 'pro', variables: 'pro' },
            lockedPanels: ['memory', 'stack', 'variables'],
        });
        const override = makeOverride({
            overrides: { memory: 'learning', stack: 'learning', variables: 'learning', output: 'pro' },
        });
        const layout = resolveLayout(template, override);
        expect(layout.memory).toBe('pro');     // locked
        expect(layout.stack).toBe('pro');       // locked
        expect(layout.variables).toBe('pro');   // locked
        expect(layout.output).toBe('pro');      // unlocked, override wins
    });

    it('all panels locked → override has zero effect', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: [...ALL_PANELS],
        });
        const override = makeOverride({
            overrides: Object.fromEntries(ALL_PANELS.map(p => [p, 'learning'])) as any,
        });
        const layout = resolveLayout(template, override);
        expect(layout).toEqual(template.panelModes);
    });
});

// ═══════════════════════════════════════════════════
// Part 3 — Non-destructive rule
// ═══════════════════════════════════════════════════

describe('Non-destructive', () => {
    it('user override record is not mutated by lock enforcement', () => {
        const override = makeOverride({ overrides: { memory: 'pro', stack: 'pro' } });
        const snap = JSON.stringify(override);
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'learning' },
            lockedPanels: ['memory'],
        });
        resolveLayout(template, override);
        expect(JSON.stringify(override)).toBe(snap);
    });

    it('override retains locked panel value in its own record', () => {
        const override = makeOverride({ overrides: { memory: 'pro' } });
        const template = makeTemplate({ lockedPanels: ['memory'] });
        resolveLayout(template, override);
        // Override still has the value — it was not stripped
        expect(override.overrides.memory).toBe('pro');
    });

    it('template is not mutated', () => {
        const template = makeTemplate({ lockedPanels: ['memory'] });
        const snap = JSON.stringify(template);
        resolveLayout(template, makeOverride({ overrides: { memory: 'pro' } }));
        expect(JSON.stringify(template)).toBe(snap);
    });
});

// ═══════════════════════════════════════════════════
// Part 4 — Edge cases
// ═══════════════════════════════════════════════════

describe('Lock edge cases', () => {
    it('locked panel with missing template value → falls back to system default', () => {
        const partial = { ...DEFAULT_PANEL_MODES };
        delete (partial as any).memory;
        const template = makeTemplate({
            panelModes: partial as any,
            lockedPanels: ['memory'],
        });
        const layout = resolveLayout(template, makeOverride({ overrides: { memory: 'pro' } }));
        expect(layout.memory).toBe('learning'); // system default, not override
    });

    it('locked panel added after override exists → override ignored at merge time', () => {
        // Simulate: override was created when memory was unlocked
        const override = makeOverride({ overrides: { memory: 'pro' }, baseVersion: 1 });
        // Then template v2 locks memory
        const template = makeTemplate({
            layoutVersion: 2,
            lockedPanels: ['memory'],
        });
        const layout = resolveLayout(template, override);
        expect(layout.memory).toBe('learning'); // locked → template value
        // Override record still has memory: 'pro' (non-destructive)
        expect(override.overrides.memory).toBe('pro');
    });

    it('locked panel removed in newer template → override applies again', () => {
        // Template v1 had memory locked
        // Template v2 unlocks it
        const template = makeTemplate({
            layoutVersion: 2,
            lockedPanels: [], // unlocked
        });
        const override = makeOverride({ overrides: { memory: 'pro' } });
        expect(resolveLayout(template, override).memory).toBe('pro');
    });

    it('override referencing locked panel → value present but not used', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, stack: 'pro' },
            lockedPanels: ['stack'],
        });
        const override = makeOverride({ overrides: { stack: 'learning' } });
        const layout = resolveLayout(template, override);
        expect(layout.stack).toBe('pro');           // lock wins
        expect(override.overrides.stack).toBe('learning'); // record intact
    });
});

// ═══════════════════════════════════════════════════
// Part 5 — Determinism guarantees
// ═══════════════════════════════════════════════════

describe('Lock determinism', () => {
    it('same locked inputs → same output over 1000 iterations', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['memory'],
        });
        const override = makeOverride({ overrides: { memory: 'learning' } });
        const baseline = resolveLayout(template, override);
        for (let i = 0; i < 1000; i++) {
            expect(resolveLayout(template, override)).toEqual(baseline);
        }
    });

    it('locking does not reorder panels', () => {
        const template = makeTemplate({ lockedPanels: ['output', 'memory'] });
        const layout = resolveLayout(template, null);
        expect(Object.keys(layout)).toEqual([...ALL_PANELS]);
    });

    it('locking does not affect unrelated panels', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['memory'],
        });
        const override = makeOverride({ overrides: { stack: 'pro' } });
        const layout = resolveLayout(template, override);
        expect(layout.stack).toBe('pro'); // unrelated, override applies
    });
});

// ═══════════════════════════════════════════════════
// Part 6 — UI signal: droppedOverridePanelIds
// ═══════════════════════════════════════════════════

describe('UI signal: droppedOverridePanelIds', () => {
    it('reports dropped panels when override hits locked panel', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['memory'],
        });
        const override = makeOverride({ overrides: { memory: 'learning' } });
        const result = resolveLayoutWithValidation(template, override);
        expect(result.droppedOverridePanelIds).toContain('memory');
    });

    it('reports multiple dropped panels', () => {
        const template = makeTemplate({
            lockedPanels: ['memory', 'stack'],
        });
        const override = makeOverride({
            overrides: { memory: 'pro', stack: 'pro', output: 'pro' },
        });
        const result = resolveLayoutWithValidation(template, override);
        expect(result.droppedOverridePanelIds).toContain('memory');
        expect(result.droppedOverridePanelIds).toContain('stack');
        expect(result.droppedOverridePanelIds).not.toContain('output');
    });

    it('reports empty when no locks', () => {
        const result = resolveLayoutWithValidation(
            makeTemplate({ lockedPanels: [] }),
            makeOverride({ overrides: { memory: 'pro' } }),
        );
        expect(result.droppedOverridePanelIds.length).toBe(0);
    });

    it('reports empty when no override', () => {
        const result = resolveLayoutWithValidation(
            makeTemplate({ lockedPanels: ['memory'] }),
            null,
        );
        expect(result.droppedOverridePanelIds.length).toBe(0);
    });

    it('reports empty when override does not touch locked panels', () => {
        const result = resolveLayoutWithValidation(
            makeTemplate({ lockedPanels: ['memory'] }),
            makeOverride({ overrides: { stack: 'pro' } }),
        );
        expect(result.droppedOverridePanelIds.length).toBe(0);
    });

    it('droppedOverridePanelIds does NOT affect layout', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['memory'],
        });
        const override = makeOverride({ overrides: { memory: 'learning' } });
        const withMeta = resolveLayoutWithValidation(template, override);
        const withoutMeta = resolveLayout(template, override);
        expect(withMeta.layout).toEqual(withoutMeta);
    });
});
