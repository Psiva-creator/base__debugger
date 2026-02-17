// ─────────────────────────────────────────────
// Tests — Merge Engine Data Contracts
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    resolveLayout,
    resolveLayoutWithValidation,
    validateMergeInputs,
    createOverride,
    createTemplate,
} from '../src/index.ts';
import { ALL_PANELS, DEFAULT_PANEL_MODES } from '../src/roles.ts';
import type { PanelId, ViewMode, PanelModeMap } from '../src/roles.ts';
import type { ProjectTemplateLayout } from '../src/template.ts';
import type { UserLayoutOverride } from '../src/overrides.ts';

// ── Helpers ──

function makeTemplate(overrides: Partial<ProjectTemplateLayout> = {}): ProjectTemplateLayout {
    return {
        ...createTemplate('proj1', 'owner1', '2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

function makeOverride(overrides: Partial<UserLayoutOverride> = {}): UserLayoutOverride {
    return {
        ...createOverride('user1', 'proj1', 1, 'device1', '2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════
// Part 1 — Output guarantees
// ═══════════════════════════════════════════════════

describe('Output: completeness', () => {
    it('output always contains all 7 PanelIds', () => {
        const layout = resolveLayout(null, null);
        for (const panelId of ALL_PANELS) {
            expect(layout[panelId]).toBeDefined();
        }
        expect(Object.keys(layout).length).toBe(7);
    });

    it('null inputs → system defaults', () => {
        const layout = resolveLayout(null, null);
        expect(layout).toEqual(DEFAULT_PANEL_MODES);
    });

    it('null override → template values', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
        });
        const layout = resolveLayout(template, null);
        expect(layout.memory).toBe('pro');
        expect(layout.stack).toBe('learning');
    });

    it('null template → system defaults (override ignored without template)', () => {
        const override = makeOverride({ overrides: { memory: 'pro' } });
        const layout = resolveLayout(null, override);
        // Without a template, overrides still apply on unlocked panels
        expect(layout.memory).toBe('pro');
    });

    it('output contains only valid ViewMode values', () => {
        const layout = resolveLayout(makeTemplate(), makeOverride({ overrides: { memory: 'pro' } }));
        for (const panelId of ALL_PANELS) {
            expect(['learning', 'pro']).toContain(layout[panelId]);
        }
    });
});

describe('Output: no mutation', () => {
    it('does not mutate template input', () => {
        const template = makeTemplate();
        const before = JSON.stringify(template);
        resolveLayout(template, makeOverride({ overrides: { memory: 'pro' } }));
        expect(JSON.stringify(template)).toBe(before);
    });

    it('does not mutate override input', () => {
        const override = makeOverride({ overrides: { memory: 'pro' } });
        const before = JSON.stringify(override);
        resolveLayout(makeTemplate(), override);
        expect(JSON.stringify(override)).toBe(before);
    });
});

// ═══════════════════════════════════════════════════
// Part 2 — Validation rules
// ═══════════════════════════════════════════════════

describe('Validation: stale override', () => {
    it('warns when override.baseVersion > template.layoutVersion', () => {
        const template = makeTemplate({ layoutVersion: 2 });
        const override = makeOverride({ baseVersion: 5 });
        const warnings = validateMergeInputs(template, override);
        expect(warnings.some(w => w.code === 'stale_override')).toBe(true);
    });

    it('no warning when baseVersion <= layoutVersion', () => {
        const template = makeTemplate({ layoutVersion: 3 });
        const override = makeOverride({ baseVersion: 2 });
        const warnings = validateMergeInputs(template, override);
        expect(warnings.some(w => w.code === 'stale_override')).toBe(false);
    });
});

describe('Validation: unknown panelId in override', () => {
    it('warns on unknown panelId', () => {
        const override = makeOverride({
            overrides: { bogusPanel: 'pro' } as any,
        });
        const warnings = validateMergeInputs(makeTemplate(), override);
        expect(warnings.some(w => w.code === 'unknown_panel_dropped')).toBe(true);
    });

    it('unknown panelId does not appear in output', () => {
        const override = makeOverride({
            overrides: { bogusPanel: 'pro' } as any,
        });
        const layout = resolveLayout(makeTemplate(), override);
        expect((layout as any).bogusPanel).toBeUndefined();
        expect(Object.keys(layout).length).toBe(7);
    });
});

describe('Validation: invalid ViewMode in override', () => {
    it('warns on invalid ViewMode', () => {
        const override = makeOverride({
            overrides: { memory: 'turbo' as any },
        });
        const warnings = validateMergeInputs(makeTemplate(), override);
        expect(warnings.some(w => w.code === 'invalid_mode_dropped')).toBe(true);
    });

    it('invalid ViewMode falls back to template/default', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
        });
        const override = makeOverride({
            overrides: { memory: 'turbo' as any },
        });
        const layout = resolveLayout(template, override);
        expect(layout.memory).toBe('pro'); // fallback to template
    });
});

describe('Validation: template missing panels', () => {
    it('warns when template is missing a panel', () => {
        const incompleteModes = { ...DEFAULT_PANEL_MODES };
        delete (incompleteModes as any).memory;
        const template = makeTemplate({
            panelModes: incompleteModes as any,
        });
        const warnings = validateMergeInputs(template, null);
        expect(warnings.some(w =>
            w.code === 'template_panel_missing' && w.message.includes('memory'),
        )).toBe(true);
    });

    it('missing template panel fills from system default', () => {
        const incompleteModes = { ...DEFAULT_PANEL_MODES };
        delete (incompleteModes as any).memory;
        const template = makeTemplate({
            panelModes: incompleteModes as any,
        });
        const layout = resolveLayout(template, null);
        expect(layout.memory).toBe('learning'); // system default
    });
});

// ═══════════════════════════════════════════════════
// Part 3 — locked panel enforcement
// ═══════════════════════════════════════════════════

describe('Locked panels', () => {
    it('locked panel uses template value, ignores override', () => {
        const template = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' },
            lockedPanels: ['memory'],
        });
        const override = makeOverride({ overrides: { memory: 'learning' } });
        const layout = resolveLayout(template, override);
        expect(layout.memory).toBe('pro');
    });

    it('unlocked panel uses override', () => {
        const template = makeTemplate({
            lockedPanels: ['memory'], // only memory locked
        });
        const override = makeOverride({ overrides: { stack: 'pro' } });
        const layout = resolveLayout(template, override);
        expect(layout.stack).toBe('pro');
    });
});

// ═══════════════════════════════════════════════════
// Part 4 — Determinism invariants
// ═══════════════════════════════════════════════════

describe('Determinism', () => {
    it('same inputs → same output over 1000 iterations', () => {
        const template = makeTemplate({ panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' } });
        const override = makeOverride({ overrides: { stack: 'pro' } });
        const baseline = resolveLayout(template, override);
        for (let i = 0; i < 1000; i++) {
            expect(resolveLayout(template, override)).toEqual(baseline);
        }
    });

    it('output key order matches ALL_PANELS', () => {
        const layout = resolveLayout(makeTemplate(), null);
        const keys = Object.keys(layout);
        expect(keys).toEqual([...ALL_PANELS]);
    });
});

// ═══════════════════════════════════════════════════
// Part 5 — resolveLayoutWithValidation
// ═══════════════════════════════════════════════════

describe('resolveLayoutWithValidation', () => {
    it('returns layout and empty warnings for clean inputs', () => {
        const result = resolveLayoutWithValidation(makeTemplate(), makeOverride());
        expect(result.layout).toBeDefined();
        expect(result.warnings.length).toBe(0);
    });

    it('returns layout and warnings for dirty inputs', () => {
        const override = makeOverride({
            baseVersion: 999,
            overrides: { bogus: 'pro', memory: 'turbo' } as any,
        });
        const result = resolveLayoutWithValidation(makeTemplate(), override);
        expect(result.layout).toBeDefined();
        expect(Object.keys(result.layout).length).toBe(7);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.some(w => w.code === 'stale_override')).toBe(true);
        expect(result.warnings.some(w => w.code === 'unknown_panel_dropped')).toBe(true);
        expect(result.warnings.some(w => w.code === 'invalid_mode_dropped')).toBe(true);
    });

    it('no metadata leakage in output layout', () => {
        const result = resolveLayoutWithValidation(makeTemplate(), makeOverride());
        const layout = result.layout as any;
        expect(layout.layoutVersion).toBeUndefined();
        expect(layout.userId).toBeUndefined();
        expect(layout.previousHash).toBeUndefined();
    });
});
