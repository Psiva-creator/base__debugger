// ─────────────────────────────────────────────
// Tests — 3-Layer Merge Cascade
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    resolveLayout,
    createOverride,
    createTemplate,
} from '../src/index.ts';
import { ALL_PANELS, DEFAULT_PANEL_MODES } from '../src/roles.ts';
import type { PanelId, ViewMode, PanelModeMap } from '../src/roles.ts';
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
// Part 1 — Merge order (Override > Template > Default)
// ═══════════════════════════════════════════════════

describe('Cascade: merge order', () => {
    it('override beats template', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
        });
        const override = makeOverride({ overrides: { memory: 'learning' } });
        expect(resolveLayout(template, override).memory).toBe('learning');
    });

    it('template beats system default', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, stack: 'pro' },
        });
        expect(resolveLayout(template, null).stack).toBe('pro');
    });

    it('system default is the fallback', () => {
        expect(resolveLayout(null, null).memory).toBe('learning');
    });

    it('override applies when no template exists', () => {
        const override = makeOverride({ overrides: { memory: 'pro' } });
        const layout = resolveLayout(null, override);
        expect(layout.memory).toBe('pro');
        expect(layout.stack).toBe('learning'); // default
    });

    it('cascade applies independently per panel', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro', stack: 'pro' },
        });
        const override = makeOverride({ overrides: { memory: 'learning' } });
        const layout = resolveLayout(template, override);
        expect(layout.memory).toBe('learning'); // override wins
        expect(layout.stack).toBe('pro');        // template wins
        expect(layout.output).toBe('learning');  // default wins
    });

    it('locked panel overrides cascade — template always wins', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['memory'],
        });
        const override = makeOverride({ overrides: { memory: 'learning' } });
        expect(resolveLayout(template, override).memory).toBe('pro');
    });
});

// ═══════════════════════════════════════════════════
// Part 2 — Panel coverage guarantee
// ═══════════════════════════════════════════════════

describe('Cascade: panel coverage', () => {
    it('output always has exactly 7 panels', () => {
        const combos: [ProjectTemplateLayout | null, UserLayoutOverride | null][] = [
            [null, null],
            [makeTemplate(), null],
            [null, makeOverride()],
            [makeTemplate(), makeOverride()],
        ];
        for (const [t, o] of combos) {
            const layout = resolveLayout(t, o);
            expect(Object.keys(layout).length).toBe(7);
            for (const p of ALL_PANELS) {
                expect(layout[p]).toBeDefined();
            }
        }
    });

    it('no unknown panelId appears in output', () => {
        const override = makeOverride({
            overrides: { fakePanelXYZ: 'pro' } as any,
        });
        const layout = resolveLayout(makeTemplate(), override);
        expect((layout as any).fakePanelXYZ).toBeUndefined();
    });

    it('partial template still produces full output', () => {
        const partial = { ...DEFAULT_PANEL_MODES };
        delete (partial as any).memory;
        delete (partial as any).stack;
        const template = makeTemplate({ panelModes: partial as any });
        const layout = resolveLayout(template, null);
        expect(Object.keys(layout).length).toBe(7);
        expect(layout.memory).toBe('learning'); // filled from default
        expect(layout.stack).toBe('learning');
    });
});

// ═══════════════════════════════════════════════════
// Part 3 — Immutability rules
// ═══════════════════════════════════════════════════

describe('Cascade: immutability', () => {
    it('does not mutate DEFAULT_PANEL_MODES', () => {
        const before = JSON.stringify(DEFAULT_PANEL_MODES);
        resolveLayout(makeTemplate(), makeOverride({ overrides: { memory: 'pro' } }));
        expect(JSON.stringify(DEFAULT_PANEL_MODES)).toBe(before);
    });

    it('does not mutate template', () => {
        const template = makeTemplate();
        const snap = JSON.stringify(template);
        resolveLayout(template, makeOverride({ overrides: { memory: 'pro' } }));
        expect(JSON.stringify(template)).toBe(snap);
    });

    it('does not mutate override', () => {
        const override = makeOverride({ overrides: { memory: 'pro' } });
        const snap = JSON.stringify(override);
        resolveLayout(makeTemplate(), override);
        expect(JSON.stringify(override)).toBe(snap);
    });

    it('output is a new object', () => {
        const layout1 = resolveLayout(null, null);
        const layout2 = resolveLayout(null, null);
        expect(layout1).toEqual(layout2);
        expect(layout1).not.toBe(layout2); // different references
    });
});

// ═══════════════════════════════════════════════════
// Part 4 — Idempotency
// ═══════════════════════════════════════════════════

describe('Cascade: idempotency', () => {
    it('calling twice with same inputs produces equal output', () => {
        const t = makeTemplate({ panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' } });
        const o = makeOverride({ overrides: { stack: 'pro' } });
        expect(resolveLayout(t, o)).toEqual(resolveLayout(t, o));
    });

    it('re-merging result as template produces same result', () => {
        const t = makeTemplate({ panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' } });
        const first = resolveLayout(t, null);
        const second = resolveLayout(makeTemplate({ panelModes: first }), null);
        expect(second).toEqual(first);
    });
});

// ═══════════════════════════════════════════════════
// Part 5 — Determinism validation
// ═══════════════════════════════════════════════════

describe('Cascade: determinism', () => {
    it('property order in input does not affect output', () => {
        const modesA: PanelModeMap = {
            memory: 'pro', controlFlow: 'learning', variables: 'learning',
            stack: 'learning', instructions: 'learning', narration: 'learning', output: 'learning',
        };
        const modesB: PanelModeMap = {
            output: 'learning', narration: 'learning', instructions: 'learning',
            stack: 'learning', variables: 'learning', controlFlow: 'learning', memory: 'pro',
        };
        const layoutA = resolveLayout(makeTemplate({ panelModes: modesA }), null);
        const layoutB = resolveLayout(makeTemplate({ panelModes: modesB }), null);
        expect(layoutA).toEqual(layoutB);
    });

    it('null template === template with all defaults', () => {
        const withNull = resolveLayout(null, null);
        const withDefault = resolveLayout(makeTemplate(), null);
        expect(withNull).toEqual(withDefault);
    });

    it('null override === override with empty overrides', () => {
        const t = makeTemplate({ panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' } });
        const withNull = resolveLayout(t, null);
        const withEmpty = resolveLayout(t, makeOverride({ overrides: {} }));
        expect(withNull).toEqual(withEmpty);
    });

    it('invalid panelId in override is safely ignored', () => {
        const override = makeOverride({
            overrides: { notAPanel: 'pro' } as any,
        });
        const layout = resolveLayout(makeTemplate(), override);
        expect(Object.keys(layout).length).toBe(7);
    });

    it('1000 iterations produce identical results', () => {
        const t = makeTemplate({ panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' } });
        const o = makeOverride({ overrides: { stack: 'pro' } });
        const baseline = resolveLayout(t, o);
        for (let i = 0; i < 1000; i++) {
            expect(resolveLayout(t, o)).toEqual(baseline);
        }
    });
});

// ═══════════════════════════════════════════════════
// Part 6 — Edge cases
// ═══════════════════════════════════════════════════

describe('Cascade: edge cases', () => {
    it('template missing some panels → filled from default', () => {
        const partial = { ...DEFAULT_PANEL_MODES };
        delete (partial as any).narration;
        const layout = resolveLayout(makeTemplate({ panelModes: partial as any }), null);
        expect(layout.narration).toBe('learning');
    });

    it('override referencing removed/unknown panel → ignored', () => {
        const override = makeOverride({
            overrides: { removedPanel: 'pro' } as any,
        });
        const layout = resolveLayout(makeTemplate(), override);
        expect((layout as any).removedPanel).toBeUndefined();
    });

    it('override for valid panel with invalid ViewMode → fallback', () => {
        const override = makeOverride({
            overrides: { memory: 'compact' as any },
        });
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
        });
        const layout = resolveLayout(template, override);
        expect(layout.memory).toBe('pro'); // invalid mode → template value
    });

    it('all panels locked → override has zero effect', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro', stack: 'pro' },
            lockedPanels: [...ALL_PANELS],
        });
        const override = makeOverride({
            overrides: { memory: 'learning', stack: 'learning', output: 'pro' },
        });
        const layout = resolveLayout(template, override);
        expect(layout).toEqual(template.panelModes);
    });

    it('empty template + empty override → system defaults', () => {
        expect(resolveLayout(makeTemplate(), makeOverride())).toEqual(DEFAULT_PANEL_MODES);
    });
});
