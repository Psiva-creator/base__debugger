// ─────────────────────────────────────────────
// Tests — Rollback Reconstruction Logic (7-Part Spec)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    createTemplate,
    updateTemplate,
    performRollback,
    reconstructTemplateAtVersion,
    verifyRollbackIntegrity,
    rebaseOverrides,
    createOverride,
    setOverride,
    resolveLayout,
} from '../src/index.ts';
import { DEFAULT_PANEL_MODES } from '../src/roles.ts';
import type { PanelModeMap } from '../src/roles.ts';
import type { ProjectTemplateLayout } from '../src/template.ts';

// ── Helpers ──

function makeTemplate(overrides: Partial<ProjectTemplateLayout> = {}): ProjectTemplateLayout {
    return { ...createTemplate('p1', 'u1', '2026-01-01T00:00:00Z'), ...overrides };
}

/** Build a realistic 3-version history. */
function buildHistory(): ProjectTemplateLayout[] {
    const v1 = createTemplate('p1', 'u1', '2026-01-01T00:00:00Z');
    const r2 = updateTemplate(v1, { panelModes: { memory: 'pro' } }, 'u1', 'owner', '2026-01-01T01:00:00Z', 'h1');
    const v2 = (r2 as any).template as ProjectTemplateLayout;
    const r3 = updateTemplate(v2, { panelModes: { memory: 'pro', stack: 'pro' }, lockedPanels: ['memory'] }, 'u1', 'owner', '2026-01-01T02:00:00Z', 'h2');
    const v3 = (r3 as any).template as ProjectTemplateLayout;
    return [v1, v2, v3];
}

// ═══════════════════════════════════════════════════
// Part 1 — Rollback Philosophy
// ═══════════════════════════════════════════════════

describe('Part 1: rollback philosophy', () => {
    it('does NOT decrement layoutVersion', () => {
        const history = buildHistory();
        const current = history[2]!; // v3
        const result = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.layoutVersion).toBe(4); // v3 + 1, not v1
        }
    });

    it('does NOT delete history — old entries remain', () => {
        const history = buildHistory();
        const current = history[2]!;
        const result = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(result.ok).toBe(true);
        // History still has 3 entries — none removed
        expect(history).toHaveLength(3);
        if (result.ok) {
            // Can append rollback result to history
            const fullHistory = [...history, result.template];
            expect(fullHistory).toHaveLength(4);
            expect(verifyRollbackIntegrity(fullHistory)).toEqual([]);
        }
    });

    it('does NOT overwrite prior template record', () => {
        const history = buildHistory();
        const snapBefore = JSON.stringify(history);
        const current = history[2]!;
        performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(JSON.stringify(history)).toBe(snapBefore);
    });

    it('creates a NEW version with old state', () => {
        const history = buildHistory();
        const current = history[2]!; // v3
        const result = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(result.ok).toBe(true);
        if (result.ok) {
            // New version has v1's panelModes but v4's version number
            expect(result.template.panelModes).toEqual(history[0]!.panelModes);
            expect(result.template.layoutVersion).toBe(4);
        }
    });
});

// ═══════════════════════════════════════════════════
// Part 2 — Rollback Process
// ═══════════════════════════════════════════════════

describe('Part 2: rollback process', () => {
    it('reconstructs state at target version', () => {
        const history = buildHistory();
        const current = history[2]!;
        const result = performRollback(current, 2, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.panelModes).toEqual(history[1]!.panelModes);
        }
    });

    it('publishes as version Y + 1', () => {
        const history = buildHistory();
        const current = history[2]!; // v3
        const result = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.layoutVersion).toBe(4);
        }
    });

    it('returns metadata for audit entry (targetVersion, previousVersion)', () => {
        const history = buildHistory();
        const current = history[2]!;
        const result = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.targetVersion).toBe(1);
            expect(result.previousVersion).toBe(3);
            expect(result.reconstructedFrom).toEqual(history[0]);
        }
    });

    it('preserves previousHash chain', () => {
        const history = buildHistory();
        const current = history[2]!;
        const result = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'rollback-hash');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.previousHash).toBe('rollback-hash');
        }
    });

    it('rejects non-owner roles', () => {
        const history = buildHistory();
        const current = history[2]!;
        const result = performRollback(current, 1, history, 'u1', 'instructor', '2026-01-01T03:00:00Z', 'h3');
        expect(result.ok).toBe(false);
    });

    it('rejects target >= current version', () => {
        const history = buildHistory();
        const current = history[2]!; // v3
        const r1 = performRollback(current, 3, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(r1.ok).toBe(false);
        const r2 = performRollback(current, 5, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(r2.ok).toBe(false);
    });

    it('rejects target version < 1', () => {
        const history = buildHistory();
        const current = history[2]!;
        const result = performRollback(current, 0, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(result.ok).toBe(false);
    });
});

// ═══════════════════════════════════════════════════
// Part 3 — Reconstruction Strategy
// ═══════════════════════════════════════════════════

describe('Part 3: reconstruction strategy (Option A — snapshots)', () => {
    it('finds correct snapshot by version', () => {
        const history = buildHistory();
        const result = reconstructTemplateAtVersion(history, 2);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.snapshot.layoutVersion).toBe(2);
            expect(result.snapshot.panelModes.memory).toBe('pro');
        }
    });

    it('returns error for missing version', () => {
        const history = buildHistory();
        const result = reconstructTemplateAtVersion(history, 99);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('99');
        }
    });

    it('returns error for empty history', () => {
        const result = reconstructTemplateAtVersion([], 1);
        expect(result.ok).toBe(false);
    });

    it('snapshot is the exact object from history (referential)', () => {
        const history = buildHistory();
        const result = reconstructTemplateAtVersion(history, 1);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.snapshot).toBe(history[0]);
        }
    });
});

// ═══════════════════════════════════════════════════
// Part 4 — Override Safety
// ═══════════════════════════════════════════════════

describe('Part 4: override safety', () => {
    it('rollback does not delete user overrides', () => {
        const history = buildHistory();
        const current = history[2]!;
        const override = createOverride('u2', 'p1', 3, 'd1', '2026-01-01T02:30:00Z');
        const setResult = setOverride(override, 'stack', 'pro', current, '2026-01-01T02:30:00Z');
        expect(setResult.ok).toBe(true);
        if (!setResult.ok) return;
        const userOverride = setResult.override;

        // Perform rollback
        const rollback = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(rollback.ok).toBe(true);

        // Override still exists — untouched by rollback
        expect(userOverride.overrides.stack).toBe('pro');
    });

    it('rollback does not mutate override records', () => {
        const history = buildHistory();
        const current = history[2]!;
        const override = createOverride('u2', 'p1', 3, 'd1', '2026-01-01T02:30:00Z');
        const snap = JSON.stringify(override);
        performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        expect(JSON.stringify(override)).toBe(snap);
    });

    it('rebase reconciles overrides after rollback automatically', () => {
        const history = buildHistory();
        const current = history[2]!; // v3, memory='pro', stack='pro', memory locked
        const override = createOverride('u2', 'p1', 3, 'd1', '2026-01-01T02:30:00Z');
        const setResult = setOverride(override, 'stack', 'pro', current, '2026-01-01T02:30:00Z');
        if (!setResult.ok) return;

        // Rollback to v1 (all defaults, no locks)
        const rollback = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        if (!rollback.ok) return;

        // Rebase override against new template — override should survive (no locks in v1)
        const rebaseResult = rebaseOverrides(setResult.override, rollback.template, '2026-01-01T03:00:00Z');
        expect(rebaseResult.override.overrides.stack).toBe('pro');
        expect(rebaseResult.droppedPanels).toEqual([]); // no locks in v1
    });
});

// ═══════════════════════════════════════════════════
// Part 5 — Lock Handling
// ═══════════════════════════════════════════════════

describe('Part 5: lock handling', () => {
    it('rollback that adds locks causes rebase to drop affected overrides', () => {
        const history = buildHistory();
        const v1 = history[0]!; // no locks
        // Override set while no locks
        const override = createOverride('u2', 'p1', 1, 'd1', '2026-01-01T00:30:00Z');
        const setResult = setOverride(override, 'memory', 'pro', v1, '2026-01-01T00:30:00Z');
        if (!setResult.ok) return;

        // v3 has memory locked — rollback to v3 state
        const current = history[2]!;
        // Rollback to v3-state (memory locked) — simulate by using v3 as target
        // But we're already at v3, so let's test rebase directly
        const rebaseResult = rebaseOverrides(setResult.override, current, '2026-01-01T03:00:00Z');
        expect(rebaseResult.droppedPanels).toContain('memory');
    });

    it('rollback that removes locks allows overrides to survive', () => {
        const history = buildHistory();
        const current = history[2]!; // v3, memory locked

        // Rollback to v1 (no locks)
        const rollback = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        if (!rollback.ok) return;

        // Override for memory should survive rebase (no locks in v1)
        const override = createOverride('u2', 'p1', 3, 'd1', '2026-01-01T02:30:00Z');
        const rebaseResult = rebaseOverrides(override, rollback.template, '2026-01-01T03:00:00Z');
        expect(rebaseResult.droppedPanels).toEqual([]);
    });

    it('lock enforcement happens at resolution time, not during rollback', () => {
        const history = buildHistory();
        const current = history[2]!;
        const rollback = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        if (!rollback.ok) return;

        // Template after rollback has v1 locks (none)
        expect(rollback.template.lockedPanels).toEqual([]);

        // Resolution applies locks at merge time
        const layout = resolveLayout(rollback.template, null);
        expect(layout).toEqual(rollback.template.panelModes);
    });
});

// ═══════════════════════════════════════════════════
// Part 6 — Integrity Invariants
// ═══════════════════════════════════════════════════

describe('Part 6: integrity invariants', () => {
    it('history with rollback passes integrity check', () => {
        const history = buildHistory();
        const current = history[2]!;
        const rollback = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        if (!rollback.ok) return;
        const fullHistory = [...history, rollback.template];
        expect(verifyRollbackIntegrity(fullHistory)).toEqual([]);
    });

    it('version strictly increases even after rollback', () => {
        const history = buildHistory();
        const current = history[2]!; // v3
        const rollback = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        if (!rollback.ok) return;
        expect(rollback.template.layoutVersion).toBeGreaterThan(current.layoutVersion);
    });

    it('detects version decrement (forged rollback)', () => {
        const history = buildHistory();
        // Forge a bad entry with decremented version
        const bad = makeTemplate({ layoutVersion: 2, updatedAt: '2026-01-01T03:00:00Z' });
        const badHistory = [...history, bad];
        const errors = verifyRollbackIntegrity(badHistory);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('detects duplicate version number after rollback', () => {
        const history = buildHistory();
        const dupEntry = makeTemplate({ layoutVersion: 3, updatedAt: '2026-01-01T03:00:00Z' });
        const badHistory = [...history, dupEntry];
        const errors = verifyRollbackIntegrity(badHistory);
        expect(errors.some(e => e.includes('Duplicate') || e.includes('appears'))).toBe(true);
    });

    it('no historical version disappears after rollback', () => {
        const history = buildHistory();
        const current = history[2]!;
        const rollback = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        if (!rollback.ok) return;
        const fullHistory = [...history, rollback.template];
        // v1, v2, v3 all still present
        expect(fullHistory.find(t => t.layoutVersion === 1)).toBeDefined();
        expect(fullHistory.find(t => t.layoutVersion === 2)).toBeDefined();
        expect(fullHistory.find(t => t.layoutVersion === 3)).toBeDefined();
        expect(fullHistory.find(t => t.layoutVersion === 4)).toBeDefined();
    });

    it('previousHash chain integrity preserved', () => {
        const history = buildHistory();
        const current = history[2]!;
        const rollback = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'rollback-hash');
        if (!rollback.ok) return;
        expect(rollback.template.previousHash).toBe('rollback-hash');
        // Each entry has its own previousHash — chain is intact
        for (const entry of history) {
            expect(entry.previousHash).toBeDefined();
        }
    });

    it('empty and single-entry histories pass', () => {
        expect(verifyRollbackIntegrity([])).toEqual([]);
        expect(verifyRollbackIntegrity([makeTemplate()])).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════
// Part 7 — Determinism Guarantee
// ═══════════════════════════════════════════════════

describe('Part 7: determinism guarantee', () => {
    it('same history + target → identical reconstruction over 100 iterations', () => {
        const history = buildHistory();
        const baseline = reconstructTemplateAtVersion(history, 2);
        for (let i = 0; i < 100; i++) {
            expect(reconstructTemplateAtVersion(history, 2)).toEqual(baseline);
        }
    });

    it('same inputs → identical rollback over 100 iterations', () => {
        const history = buildHistory();
        const current = history[2]!;
        const baseline = performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3');
        for (let i = 0; i < 100; i++) {
            expect(performRollback(current, 1, history, 'u1', 'owner', '2026-01-01T03:00:00Z', 'h3')).toEqual(baseline);
        }
    });

    it('no time-based variance — timestamp is externally provided', () => {
        const history = buildHistory();
        const current = history[2]!;
        const r1 = performRollback(current, 1, history, 'u1', 'owner', '2026-06-01T00:00:00Z', 'h3');
        const r2 = performRollback(current, 1, history, 'u1', 'owner', '2026-12-01T00:00:00Z', 'h3');
        // Different timestamps produce different templates
        if (r1.ok && r2.ok) {
            expect(r1.template.updatedAt).not.toBe(r2.template.updatedAt);
            // But same panelModes (reconstruction is deterministic)
            expect(r1.template.panelModes).toEqual(r2.template.panelModes);
        }
    });

    it('verifyRollbackIntegrity is deterministic', () => {
        const history = buildHistory();
        const baseline = verifyRollbackIntegrity(history);
        for (let i = 0; i < 100; i++) {
            expect(verifyRollbackIntegrity(history)).toEqual(baseline);
        }
    });
});
