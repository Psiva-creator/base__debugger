// ─────────────────────────────────────────────
// Tests — Governance Audit Event Model (5-Part Spec)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    createAuditEntry,
    createAuditEntryFromDelta,
    computeAuditDelta,
    validateAuditEntry,
    verifyLogIntegrity,
    isValidAuditAction,
    ALL_AUDIT_ACTIONS,
} from '../src/index.ts';
import { DEFAULT_PANEL_MODES, ALL_PANELS } from '../src/roles.ts';
import type { PanelModeMap } from '../src/roles.ts';
import type { LayoutAuditEntry, AuditAction } from '../src/audit.ts';

// ── Helpers ──

function makeEntry(overrides: Partial<LayoutAuditEntry> = {}): LayoutAuditEntry {
    return createAuditEntry(
        overrides.entryId ?? 'e1',
        overrides.projectId ?? 'p1',
        overrides.userId ?? 'u1',
        overrides.role ?? 'owner',
        overrides.timestamp ?? '2026-01-01T00:00:00Z',
        overrides.action ?? 'template_update',
        overrides.changedKeys ?? ['memory'],
        overrides.before ?? { memory: 'learning' },
        overrides.after ?? { memory: 'pro' },
        overrides.metadata ?? {},
        overrides.layoutVersion ?? 2,
        overrides.previousHash ?? 'abc123',
    );
}

function makeLayout(overrides: Partial<PanelModeMap> = {}): PanelModeMap {
    return { ...DEFAULT_PANEL_MODES, ...overrides };
}

// ═══════════════════════════════════════════════════
// Part 1 — Audit Entry Structure
// ═══════════════════════════════════════════════════

describe('Part 1: LayoutAuditEntry structure', () => {
    it('includes all required fields', () => {
        const entry = makeEntry();
        expect(entry.entryId).toBe('e1');
        expect(entry.projectId).toBe('p1');
        expect(entry.userId).toBe('u1');
        expect(entry.role).toBe('owner');
        expect(entry.timestamp).toBe('2026-01-01T00:00:00Z');
        expect(entry.action).toBe('template_update');
        expect(entry.changedKeys).toEqual(['memory']);
        expect(entry.before).toEqual({ memory: 'learning' });
        expect(entry.after).toEqual({ memory: 'pro' });
        expect(entry.layoutVersion).toBe(2);
        expect(entry.previousHash).toBe('abc123');
        expect(entry.metadata).toEqual({});
    });

    it('layoutVersion and previousHash have sensible defaults', () => {
        const entry = createAuditEntry(
            'e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z',
            'template_create', [], {}, {},
        );
        expect(entry.layoutVersion).toBe(0);
        expect(entry.previousHash).toBe('');
    });

    it('previousHash chains for integrity', () => {
        const e1 = makeEntry({ entryId: 'e1', previousHash: '' });
        const e2 = makeEntry({ entryId: 'e2', previousHash: 'hash-of-e1' });
        expect(e1.previousHash).toBe('');
        expect(e2.previousHash).toBe('hash-of-e1');
    });

    it('metadata can carry arbitrary context', () => {
        const entry = makeEntry({ metadata: { targetVersion: 3, reason: 'rollback' } });
        expect(entry.metadata).toEqual({ targetVersion: 3, reason: 'rollback' });
    });
});

// ═══════════════════════════════════════════════════
// Part 2 — Action Types
// ═══════════════════════════════════════════════════

describe('Part 2: AuditAction types', () => {
    it('ALL_AUDIT_ACTIONS contains exactly 8 values', () => {
        expect(ALL_AUDIT_ACTIONS).toHaveLength(8);
    });

    it('ALL_AUDIT_ACTIONS includes every required action', () => {
        const required: AuditAction[] = [
            'template_create', 'template_update', 'template_reset',
            'draft_publish', 'role_change', 'panel_lock',
            'force_sync', 'rollback',
        ];
        for (const action of required) {
            expect(ALL_AUDIT_ACTIONS).toContain(action);
        }
    });

    it('isValidAuditAction returns true for valid actions', () => {
        for (const action of ALL_AUDIT_ACTIONS) {
            expect(isValidAuditAction(action)).toBe(true);
        }
    });

    it('isValidAuditAction returns false for unknown actions', () => {
        expect(isValidAuditAction('unknown_action')).toBe(false);
        expect(isValidAuditAction('')).toBe(false);
        expect(isValidAuditAction('TEMPLATE_UPDATE')).toBe(false);
    });

    it('each action can be used to create a valid entry', () => {
        for (const action of ALL_AUDIT_ACTIONS) {
            const entry = createAuditEntry(
                `e-${action}`, 'p1', 'u1', 'owner',
                '2026-01-01T00:00:00Z', action, [], {}, {},
            );
            expect(entry.action).toBe(action);
            expect(validateAuditEntry(entry)).toEqual([]);
        }
    });
});

// ═══════════════════════════════════════════════════
// Part 3 — Delta Recording Rule
// ═══════════════════════════════════════════════════

describe('Part 3: computeAuditDelta', () => {
    it('records only changed panel keys', () => {
        const before = makeLayout({ memory: 'learning', stack: 'learning' });
        const after = makeLayout({ memory: 'pro', stack: 'learning' });
        const delta = computeAuditDelta(before, after);
        expect(delta.changedKeys).toEqual(['memory']);
        expect(delta.before).toEqual({ memory: 'learning' });
        expect(delta.after).toEqual({ memory: 'pro' });
    });

    it('returns empty delta when nothing changed', () => {
        const state = makeLayout();
        const delta = computeAuditDelta(state, state);
        expect(delta.changedKeys).toEqual([]);
        expect(delta.before).toEqual({});
        expect(delta.after).toEqual({});
    });

    it('records multiple changed panels', () => {
        const before = makeLayout({ memory: 'learning', stack: 'learning', output: 'learning' });
        const after = makeLayout({ memory: 'pro', stack: 'pro', output: 'learning' });
        const delta = computeAuditDelta(before, after);
        expect(delta.changedKeys).toEqual(['memory', 'stack']);
        expect(delta.before.memory).toBe('learning');
        expect(delta.after.memory).toBe('pro');
        expect(delta.before.stack).toBe('learning');
        expect(delta.after.stack).toBe('pro');
    });

    it('does not include unchanged panels in before/after', () => {
        const before = makeLayout({ memory: 'pro' });
        const after = makeLayout({ memory: 'learning' });
        const delta = computeAuditDelta(before, after);
        // Only memory changed — no other panels in before/after
        expect(Object.keys(delta.before)).toEqual(['memory']);
        expect(Object.keys(delta.after)).toEqual(['memory']);
    });

    it('iterates panels in canonical ALL_PANELS order', () => {
        const before = makeLayout({ output: 'learning', memory: 'learning' });
        const after = makeLayout({ output: 'pro', memory: 'pro' });
        const delta = computeAuditDelta(before, after);
        // memory comes before output in ALL_PANELS
        const memIdx = delta.changedKeys.indexOf('memory');
        const outIdx = delta.changedKeys.indexOf('output');
        expect(memIdx).toBeLessThan(outIdx);
    });
});

// ═══════════════════════════════════════════════════
// Part 4 — Determinism Requirement
// ═══════════════════════════════════════════════════

describe('Part 4: determinism', () => {
    it('same before/after → identical delta over 1000 iterations', () => {
        const before = makeLayout({ memory: 'learning', stack: 'pro' });
        const after = makeLayout({ memory: 'pro', stack: 'learning' });
        const baseline = computeAuditDelta(before, after);
        for (let i = 0; i < 1000; i++) {
            expect(computeAuditDelta(before, after)).toEqual(baseline);
        }
    });

    it('createAuditEntry is deterministic', () => {
        const baseline = makeEntry();
        for (let i = 0; i < 100; i++) {
            expect(makeEntry()).toEqual(baseline);
        }
    });

    it('createAuditEntryFromDelta is deterministic', () => {
        const before = makeLayout({ memory: 'learning' });
        const after = makeLayout({ memory: 'pro' });
        const baseline = createAuditEntryFromDelta(
            'e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z',
            'template_update', before, after, 2, 'abc', {},
        );
        for (let i = 0; i < 100; i++) {
            const result = createAuditEntryFromDelta(
                'e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z',
                'template_update', before, after, 2, 'abc', {},
            );
            expect(result).toEqual(baseline);
        }
    });

    it('no randomness in delta generation', () => {
        const before = makeLayout();
        const after = makeLayout({ memory: 'pro', stack: 'pro', output: 'pro' });
        const results = new Set<string>();
        for (let i = 0; i < 100; i++) {
            results.add(JSON.stringify(computeAuditDelta(before, after)));
        }
        expect(results.size).toBe(1);
    });

    it('timestamp is externally provided — never generated', () => {
        const ts = '2026-06-15T12:34:56Z';
        const entry = makeEntry({ timestamp: ts });
        expect(entry.timestamp).toBe(ts);
    });
});

// ═══════════════════════════════════════════════════
// Part 5 — Immutability / Append-Only
// ═══════════════════════════════════════════════════

describe('Part 5: immutability & append-only', () => {
    it('audit entries are never edited — factory returns new object', () => {
        const a = makeEntry();
        const b = makeEntry();
        expect(a).not.toBe(b); // different reference
        expect(a).toEqual(b);  // same value
    });

    it('rollback creates a new entry — does not erase history', () => {
        const original = makeEntry({
            entryId: 'e1',
            action: 'template_update',
            changedKeys: ['memory'],
            before: { memory: 'learning' },
            after: { memory: 'pro' },
            layoutVersion: 2,
        });
        const rollback = makeEntry({
            entryId: 'e2',
            action: 'rollback',
            changedKeys: ['memory'],
            before: { memory: 'pro' },
            after: { memory: 'learning' },
            layoutVersion: 3,
            previousHash: 'hash-of-e1',
            metadata: { rolledBackEntryId: 'e1' },
        });
        // Both entries exist — history preserved
        const log = [original, rollback];
        expect(verifyLogIntegrity(log)).toEqual([]);
        expect(log).toHaveLength(2);
    });

    it('verifyLogIntegrity detects duplicate entryIds', () => {
        const log = [
            makeEntry({ entryId: 'e1', timestamp: '2026-01-01T00:00:00Z' }),
            makeEntry({ entryId: 'e1', timestamp: '2026-01-01T01:00:00Z' }),
        ];
        const errors = verifyLogIntegrity(log);
        expect(errors.some(e => e.includes('Duplicate entryId'))).toBe(true);
    });

    it('verifyLogIntegrity passes for unique entryIds', () => {
        const log = [
            makeEntry({ entryId: 'e1', timestamp: '2026-01-01T00:00:00Z' }),
            makeEntry({ entryId: 'e2', timestamp: '2026-01-01T01:00:00Z' }),
        ];
        expect(verifyLogIntegrity(log)).toEqual([]);
    });

    it('verifyLogIntegrity detects out-of-order timestamps', () => {
        const log = [
            makeEntry({ entryId: 'e1', timestamp: '2026-01-01T02:00:00Z' }),
            makeEntry({ entryId: 'e2', timestamp: '2026-01-01T01:00:00Z' }),
        ];
        const errors = verifyLogIntegrity(log);
        expect(errors.some(e => e.includes('precedes'))).toBe(true);
    });

    it('verifyLogIntegrity detects projectId mismatch', () => {
        const log = [
            makeEntry({ entryId: 'e1', projectId: 'p1' }),
            makeEntry({ entryId: 'e2', projectId: 'p2' }),
        ];
        const errors = verifyLogIntegrity(log);
        expect(errors.some(e => e.includes('projectId'))).toBe(true);
    });

    it('createAuditEntry does not mutate input arguments', () => {
        const before = { memory: 'learning' as const };
        const after = { memory: 'pro' as const };
        const meta = { key: 'val' };
        const snapBefore = JSON.stringify(before);
        const snapAfter = JSON.stringify(after);
        const snapMeta = JSON.stringify(meta);
        createAuditEntry('e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z',
            'template_update', ['memory'], before, after, meta, 2, 'hash');
        expect(JSON.stringify(before)).toBe(snapBefore);
        expect(JSON.stringify(after)).toBe(snapAfter);
        expect(JSON.stringify(meta)).toBe(snapMeta);
    });
});
