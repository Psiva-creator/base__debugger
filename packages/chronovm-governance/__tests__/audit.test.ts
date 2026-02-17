// ─────────────────────────────────────────────
// Tests — Audit Logging
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    createAuditEntry,
    validateAuditEntry,
    verifyLogIntegrity,
} from '../src/audit.ts';
import type { LayoutAuditEntry } from '../src/audit.ts';

describe('createAuditEntry', () => {
    it('creates a well-formed entry', () => {
        const entry = createAuditEntry(
            'entry-1',
            'proj1',
            'user1',
            'owner',
            '2026-01-01T00:00:00Z',
            'template_update',
            ['memory'],
            { memory: 'learning' },
            { memory: 'pro' },
        );
        expect(entry.entryId).toBe('entry-1');
        expect(entry.action).toBe('template_update');
        expect(entry.changedKeys).toEqual(['memory']);
        expect(entry.before.memory).toBe('learning');
        expect(entry.after.memory).toBe('pro');
    });

    it('supports metadata', () => {
        const entry = createAuditEntry(
            'entry-1', 'proj1', 'user1', 'owner',
            '2026-01-01T00:00:00Z', 'rollback',
            [], {}, {}, { targetVersion: 3 },
        );
        expect(entry.metadata).toEqual({ targetVersion: 3 });
    });
});

describe('validateAuditEntry', () => {
    it('returns no errors for valid entry', () => {
        const entry = createAuditEntry(
            'e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z',
            'template_update', ['memory'], { memory: 'learning' }, { memory: 'pro' },
        );
        expect(validateAuditEntry(entry)).toEqual([]);
    });

    it('returns error for missing entryId', () => {
        const entry = createAuditEntry(
            '', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z',
            'template_update', [], {}, {},
        );
        const errors = validateAuditEntry(entry);
        expect(errors).toContain('entryId is required');
    });

    it('returns error for changedKey not in before/after', () => {
        const entry = createAuditEntry(
            'e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z',
            'template_update', ['memory'], {}, {}, // memory not in before or after
        );
        const errors = validateAuditEntry(entry);
        expect(errors.some(e => e.includes('memory'))).toBe(true);
    });
});

describe('verifyLogIntegrity', () => {
    it('returns no errors for properly ordered log', () => {
        const entries: LayoutAuditEntry[] = [
            createAuditEntry('e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z', 'template_create', [], {}, {}),
            createAuditEntry('e2', 'p1', 'u1', 'owner', '2026-01-01T01:00:00Z', 'template_update', ['memory'], { memory: 'learning' }, { memory: 'pro' }),
        ];
        expect(verifyLogIntegrity(entries)).toEqual([]);
    });

    it('detects out-of-order timestamps', () => {
        const entries: LayoutAuditEntry[] = [
            createAuditEntry('e1', 'p1', 'u1', 'owner', '2026-01-01T02:00:00Z', 'template_create', [], {}, {}),
            createAuditEntry('e2', 'p1', 'u1', 'owner', '2026-01-01T01:00:00Z', 'template_update', [], {}, {}),
        ];
        const errors = verifyLogIntegrity(entries);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('detects projectId mismatch', () => {
        const entries: LayoutAuditEntry[] = [
            createAuditEntry('e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z', 'template_create', [], {}, {}),
            createAuditEntry('e2', 'p2', 'u1', 'owner', '2026-01-01T01:00:00Z', 'template_create', [], {}, {}),
        ];
        const errors = verifyLogIntegrity(entries);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('handles empty log', () => {
        expect(verifyLogIntegrity([])).toEqual([]);
    });

    it('handles single-entry log', () => {
        const entries: LayoutAuditEntry[] = [
            createAuditEntry('e1', 'p1', 'u1', 'owner', '2026-01-01T00:00:00Z', 'template_create', [], {}, {}),
        ];
        expect(verifyLogIntegrity(entries)).toEqual([]);
    });
});
