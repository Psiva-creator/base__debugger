// ─────────────────────────────────────────────
// Tests — Layout Versioning System (6-Part Spec)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    createTemplate,
    updateTemplate,
    resetTemplate,
    publishDraft,
    rollbackTemplate,
    shouldIncrementVersion,
    validateVersionForUpdate,
    verifyVersionIntegrity,
    VERSION_INCREMENT_TRIGGERS,
    VERSION_NO_INCREMENT_ACTIONS,
    resolveLayout,
    rebaseOverrides,
    createOverride,
} from '../src/index.ts';
import { DEFAULT_PANEL_MODES, ALL_PANELS } from '../src/roles.ts';
import type { PanelModeMap } from '../src/roles.ts';
import type { ProjectTemplateLayout } from '../src/template.ts';
import type { AuditAction } from '../src/audit.ts';

// ── Helpers ──

function makeTemplate(overrides: Partial<ProjectTemplateLayout> = {}): ProjectTemplateLayout {
    return { ...createTemplate('p1', 'u1', '2026-01-01T00:00:00Z'), ...overrides };
}

const TS = '2026-02-01T00:00:00Z';

// ═══════════════════════════════════════════════════
// Part 1 — Version Definition
// ═══════════════════════════════════════════════════

describe('Part 1: version definition', () => {
    it('createTemplate starts at layoutVersion 1', () => {
        const t = createTemplate('p1', 'u1', TS);
        expect(t.layoutVersion).toBe(1);
    });

    it('updateTemplate increments by exactly +1', () => {
        const t = makeTemplate({ layoutVersion: 5 });
        const result = updateTemplate(t, { panelModes: { memory: 'pro' } }, 'u1', 'owner', TS, 'h1');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.template.layoutVersion).toBe(6);
    });

    it('resetTemplate increments by exactly +1', () => {
        const t = makeTemplate({ layoutVersion: 3 });
        const result = resetTemplate(t, 'u1', 'owner', TS, 'h1');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.template.layoutVersion).toBe(4);
    });

    it('publishDraft increments by exactly +1', () => {
        const t = makeTemplate({ layoutVersion: 7 });
        const result = publishDraft(t, DEFAULT_PANEL_MODES, [], 'u1', 'owner', TS, 'h1');
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.template.layoutVersion).toBe(8);
    });

    it('rollbackTemplate increments by exactly +1 (never reverts version)', () => {
        const t = makeTemplate({ layoutVersion: 10 });
        const result = rollbackTemplate(
            t, { panelModes: DEFAULT_PANEL_MODES, lockedPanels: [] },
            'u1', 'owner', TS, 'h1',
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.template.layoutVersion).toBe(11);
    });

    it('version is always a positive integer', () => {
        let t = createTemplate('p1', 'u1', TS);
        expect(t.layoutVersion).toBeGreaterThan(0);
        expect(Number.isInteger(t.layoutVersion)).toBe(true);
        for (let i = 0; i < 10; i++) {
            const result = updateTemplate(t, {}, 'u1', 'owner', TS, `h${i}`);
            if (result.ok) {
                t = result.template;
                expect(t.layoutVersion).toBeGreaterThan(0);
                expect(Number.isInteger(t.layoutVersion)).toBe(true);
            }
        }
    });
});

// ═══════════════════════════════════════════════════
// Part 2 — Version Increment Triggers
// ═══════════════════════════════════════════════════

describe('Part 2: version increment triggers', () => {
    it('INCREMENT_TRIGGERS includes all template-mutating actions', () => {
        const required: AuditAction[] = [
            'template_create', 'template_update', 'template_reset',
            'draft_publish', 'rollback', 'panel_lock',
        ];
        for (const action of required) {
            expect(VERSION_INCREMENT_TRIGGERS).toContain(action);
        }
    });

    it('NO_INCREMENT_ACTIONS includes non-mutating actions', () => {
        const nonMutating: AuditAction[] = ['role_change', 'force_sync'];
        for (const action of nonMutating) {
            expect(VERSION_NO_INCREMENT_ACTIONS).toContain(action);
        }
    });

    it('triggers + non-triggers cover all AuditAction values', () => {
        const all = [...VERSION_INCREMENT_TRIGGERS, ...VERSION_NO_INCREMENT_ACTIONS];
        expect(all).toHaveLength(8); // 6 + 2 = all 8 AuditActions
    });

    it('shouldIncrementVersion returns true for triggers', () => {
        for (const action of VERSION_INCREMENT_TRIGGERS) {
            expect(shouldIncrementVersion(action)).toBe(true);
        }
    });

    it('shouldIncrementVersion returns false for non-triggers', () => {
        for (const action of VERSION_NO_INCREMENT_ACTIONS) {
            expect(shouldIncrementVersion(action)).toBe(false);
        }
    });
});

// ═══════════════════════════════════════════════════
// Part 3 — Atomic Update Requirement
// ═══════════════════════════════════════════════════

describe('Part 3: atomic update', () => {
    it('successful update returns both new template and bumped version', () => {
        const t = makeTemplate();
        const result = updateTemplate(t, { panelModes: { memory: 'pro' } }, 'u1', 'owner', TS, 'h1');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.panelModes.memory).toBe('pro');
            expect(result.template.layoutVersion).toBe(t.layoutVersion + 1);
        }
    });

    it('failed update does not increment version (no partial state)', () => {
        const t = makeTemplate();
        const result = updateTemplate(t, { panelModes: { memory: 'pro' } }, 'u1', 'viewer', TS, 'h1');
        expect(result.ok).toBe(false);
        // Original template unchanged
        expect(t.layoutVersion).toBe(1);
    });

    it('failed publishDraft does not increment version', () => {
        const t = makeTemplate();
        const result = publishDraft(t, DEFAULT_PANEL_MODES, [], 'u1', 'viewer', TS, 'h1');
        expect(result.ok).toBe(false);
        expect(t.layoutVersion).toBe(1);
    });

    it('failed rollback does not increment version', () => {
        const t = makeTemplate();
        const result = rollbackTemplate(
            t, { panelModes: DEFAULT_PANEL_MODES, lockedPanels: [] },
            'u1', 'viewer', TS, 'h1',
        );
        expect(result.ok).toBe(false);
        expect(t.layoutVersion).toBe(1);
    });

    it('original template is never mutated on any operation', () => {
        const t = makeTemplate();
        const snap = JSON.stringify(t);
        updateTemplate(t, { panelModes: { memory: 'pro' } }, 'u1', 'owner', TS, 'h1');
        resetTemplate(t, 'u1', 'owner', TS, 'h1');
        publishDraft(t, DEFAULT_PANEL_MODES, [], 'u1', 'owner', TS, 'h1');
        rollbackTemplate(t, { panelModes: DEFAULT_PANEL_MODES, lockedPanels: [] }, 'u1', 'owner', TS, 'h1');
        expect(JSON.stringify(t)).toBe(snap);
    });
});

// ═══════════════════════════════════════════════════
// Part 4 — Version Conflict Handling
// ═══════════════════════════════════════════════════

describe('Part 4: version conflict handling', () => {
    it('accepts current version', () => {
        const t = makeTemplate({ layoutVersion: 5 });
        const result = validateVersionForUpdate(5, t);
        expect(result.ok).toBe(true);
    });

    it('rejects stale version (client < template)', () => {
        const t = makeTemplate({ layoutVersion: 5 });
        const result = validateVersionForUpdate(3, t);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('Stale');
            expect(result.reason).toContain('Re-fetch');
        }
    });

    it('rejects ahead version (client > template)', () => {
        const t = makeTemplate({ layoutVersion: 5 });
        const result = validateVersionForUpdate(8, t);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('skipping');
        }
    });

    it('concurrent publish: second writer gets stale rejection', () => {
        const t = makeTemplate({ layoutVersion: 5 });
        // Instructor A publishes first
        const resultA = updateTemplate(t, { panelModes: { memory: 'pro' } }, 'uA', 'instructor', TS, 'hA');
        expect(resultA.ok).toBe(true);
        // Now template is at v6
        if (resultA.ok) {
            // Instructor B tries to update based on v5 (stale)
            const conflict = validateVersionForUpdate(5, resultA.template);
            expect(conflict.ok).toBe(false);
        }
    });

    it('rollback targets old version but creates new version number', () => {
        const t = makeTemplate({ layoutVersion: 5 });
        // Rollback to v2 state — but version becomes 6, not 2
        const result = rollbackTemplate(
            t, { panelModes: DEFAULT_PANEL_MODES, lockedPanels: [] },
            'u1', 'owner', TS, 'h1',
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.layoutVersion).toBe(6); // v5 + 1, not v2
        }
    });
});

// ═══════════════════════════════════════════════════
// Part 5 — Version Integrity Invariants
// ═══════════════════════════════════════════════════

describe('Part 5: version integrity invariants', () => {
    it('valid sequence passes integrity check', () => {
        const t1 = makeTemplate({ layoutVersion: 1, updatedAt: '2026-01-01T00:00:00Z' });
        const r2 = updateTemplate(t1, { panelModes: { memory: 'pro' } }, 'u1', 'owner', '2026-01-01T01:00:00Z', 'h1');
        const r3 = updateTemplate((r2 as any).template, {}, 'u1', 'owner', '2026-01-01T02:00:00Z', 'h2');
        const history = [t1, (r2 as any).template, (r3 as any).template];
        expect(verifyVersionIntegrity(history)).toEqual([]);
    });

    it('detects version gap (skipped version)', () => {
        const history = [
            makeTemplate({ layoutVersion: 1, updatedAt: '2026-01-01T00:00:00Z' }),
            makeTemplate({ layoutVersion: 3, updatedAt: '2026-01-01T01:00:00Z' }), // skipped v2
        ];
        const errors = verifyVersionIntegrity(history);
        expect(errors.some(e => e.includes('gap'))).toBe(true);
    });

    it('detects duplicate version numbers', () => {
        const history = [
            makeTemplate({ layoutVersion: 1, updatedAt: '2026-01-01T00:00:00Z' }),
            makeTemplate({ layoutVersion: 1, updatedAt: '2026-01-01T01:00:00Z' }),
        ];
        const errors = verifyVersionIntegrity(history);
        expect(errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('detects timestamp regression', () => {
        const history = [
            makeTemplate({ layoutVersion: 1, updatedAt: '2026-01-01T05:00:00Z' }),
            makeTemplate({ layoutVersion: 2, updatedAt: '2026-01-01T01:00:00Z' }),
        ];
        const errors = verifyVersionIntegrity(history);
        expect(errors.some(e => e.includes('Timestamp'))).toBe(true);
    });

    it('detects projectId mismatch', () => {
        const history = [
            makeTemplate({ layoutVersion: 1, projectId: 'p1' }),
            makeTemplate({ layoutVersion: 2, projectId: 'p2' }),
        ];
        const errors = verifyVersionIntegrity(history);
        expect(errors.some(e => e.includes('ProjectId'))).toBe(true);
    });

    it('rollback in history creates new version, passes integrity', () => {
        const t1 = makeTemplate({ layoutVersion: 1, updatedAt: '2026-01-01T00:00:00Z' });
        const r2 = updateTemplate(t1, { panelModes: { memory: 'pro' } }, 'u1', 'owner', '2026-01-01T01:00:00Z', 'h1');
        const t2 = (r2 as any).template as ProjectTemplateLayout;
        const r3 = rollbackTemplate(t2, { panelModes: DEFAULT_PANEL_MODES, lockedPanels: [] }, 'u1', 'owner', '2026-01-01T02:00:00Z', 'h2');
        const t3 = (r3 as any).template as ProjectTemplateLayout;
        // History: v1 → v2 → v3 (rollback creates v3, not overwriting v1)
        expect(verifyVersionIntegrity([t1, t2, t3])).toEqual([]);
        expect(t3.layoutVersion).toBe(3);
    });

    it('empty and single-entry histories pass', () => {
        expect(verifyVersionIntegrity([])).toEqual([]);
        expect(verifyVersionIntegrity([makeTemplate()])).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════
// Part 6 — Determinism Boundary
// ═══════════════════════════════════════════════════

describe('Part 6: determinism boundary', () => {
    it('version change does not affect merge/resolveLayout output', () => {
        const t1 = makeTemplate({ layoutVersion: 1, panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' } });
        const t2 = makeTemplate({ layoutVersion: 99, panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' } });
        // Same panel modes, different version — resolveLayout should be identical
        const layout1 = resolveLayout(t1, null);
        const layout2 = resolveLayout(t2, null);
        expect(layout1).toEqual(layout2);
    });

    it('version does not modify user overrides', () => {
        const override = createOverride('u1', 'p1', 1, 'd1', TS);
        const t = makeTemplate({ layoutVersion: 5 });
        const result = rebaseOverrides(override, t, TS);
        // Override keeps its own data — version is metadata only
        expect(result.override.userId).toBe('u1');
        expect(result.override.baseVersion).toBe(5); // bumped to template version, not modified
    });

    it('shouldIncrementVersion is deterministic', () => {
        const results = new Set<boolean>();
        for (let i = 0; i < 100; i++) {
            results.add(shouldIncrementVersion('template_update'));
        }
        expect(results.size).toBe(1);
    });

    it('validateVersionForUpdate is deterministic', () => {
        const t = makeTemplate({ layoutVersion: 5 });
        const baseline = validateVersionForUpdate(3, t);
        for (let i = 0; i < 100; i++) {
            expect(validateVersionForUpdate(3, t)).toEqual(baseline);
        }
    });

    it('verifyVersionIntegrity is deterministic over 100 iterations', () => {
        const history = [
            makeTemplate({ layoutVersion: 1, updatedAt: '2026-01-01T00:00:00Z' }),
            makeTemplate({ layoutVersion: 2, updatedAt: '2026-01-01T01:00:00Z' }),
        ];
        const baseline = verifyVersionIntegrity(history);
        for (let i = 0; i < 100; i++) {
            expect(verifyVersionIntegrity(history)).toEqual(baseline);
        }
    });
});
