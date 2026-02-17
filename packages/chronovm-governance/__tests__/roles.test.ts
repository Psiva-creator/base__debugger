// ─────────────────────────────────────────────
// Tests — Permission Predicate Engine
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    isAllowed,
    checkPermission,
    permittedActions,
    createMembership,
    isValidRole,
    isValidCapability,
    can,
    canModifyPanel,
    canAll,
    canAny,
} from '../src/roles.ts';
import type { ProjectRole, GovernanceCapability, PermissionResult } from '../src/roles.ts';

// ── All 4 roles ──
const ALL_ROLES: ProjectRole[] = ['owner', 'instructor', 'maintainer', 'viewer'];

// ═══════════════════════════════════════════════════
// 1. Validation Guards
// ═══════════════════════════════════════════════════

describe('isValidRole', () => {
    it('accepts all valid roles', () => {
        for (const role of ALL_ROLES) {
            expect(isValidRole(role)).toBe(true);
        }
    });

    it('rejects unknown roles', () => {
        expect(isValidRole('admin')).toBe(false);
        expect(isValidRole('superuser')).toBe(false);
        expect(isValidRole('')).toBe(false);
    });
});

describe('isValidCapability', () => {
    it('accepts valid capabilities', () => {
        expect(isValidCapability('template:create')).toBe(true);
        expect(isValidCapability('draft:publish')).toBe(true);
        expect(isValidCapability('audit:export')).toBe(true);
    });

    it('rejects unknown capabilities', () => {
        expect(isValidCapability('template:fly')).toBe(false);
        expect(isValidCapability('user:delete')).toBe(false);
        expect(isValidCapability('')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════
// 2. Unified can() Predicate
// ═══════════════════════════════════════════════════

describe('can', () => {
    // ── Denial codes ──

    it('returns unknown_role for invalid role', () => {
        const result = can('admin', 'template:create');
        expect(result.granted).toBe(false);
        if (!result.granted) {
            expect(result.code).toBe('unknown_role');
        }
    });

    it('returns unknown_capability for invalid capability', () => {
        const result = can('owner', 'template:fly');
        expect(result.granted).toBe(false);
        if (!result.granted) {
            expect(result.code).toBe('unknown_capability');
        }
    });

    it('returns insufficient_role for unauthorized', () => {
        const result = can('viewer', 'template:edit');
        expect(result.granted).toBe(false);
        if (!result.granted) {
            expect(result.code).toBe('insufficient_role');
        }
    });

    it('returns panel_locked for locked panel context', () => {
        const result = can('viewer', 'override:modify_own', {
            panelId: 'memory',
            lockedPanels: ['memory'],
        });
        expect(result.granted).toBe(false);
        if (!result.granted) {
            expect(result.code).toBe('panel_locked');
        }
    });

    // ── Grants ──

    it('grants owner template:create', () => {
        expect(can('owner', 'template:create').granted).toBe(true);
    });

    it('grants viewer override:modify_own', () => {
        expect(can('viewer', 'override:modify_own').granted).toBe(true);
    });

    it('grants with context when panel is not locked', () => {
        const result = can('viewer', 'override:modify_own', {
            panelId: 'memory',
            lockedPanels: ['stack'], // memory not locked
        });
        expect(result.granted).toBe(true);
    });

    // ── Never throws ──

    it('never throws on any input', () => {
        expect(() => can('', '')).not.toThrow();
        expect(() => can('???', '!!!')).not.toThrow();
        expect(() => can('owner', 'template:create', {} as any)).not.toThrow();
    });

    // ── Determinism ──

    it('returns identical results for identical inputs', () => {
        const results = Array.from({ length: 100 }, () =>
            can('instructor', 'template:edit'),
        );
        expect(results.every(r => r.granted === true)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════
// 3. Per-Panel Check
// ═══════════════════════════════════════════════════

describe('canModifyPanel', () => {
    it('grants viewer on unlocked panel', () => {
        expect(canModifyPanel('viewer', 'memory', []).granted).toBe(true);
    });

    it('denies viewer on locked panel', () => {
        const result = canModifyPanel('viewer', 'memory', ['memory']);
        expect(result.granted).toBe(false);
        if (!result.granted) {
            expect(result.code).toBe('panel_locked');
        }
    });

    it('denies owner on locked panel (no lock bypass)', () => {
        const result = canModifyPanel('owner', 'stack', ['stack']);
        expect(result.granted).toBe(false);
        if (!result.granted) {
            expect(result.code).toBe('panel_locked');
        }
    });

    it('grants when different panel is locked', () => {
        expect(canModifyPanel('owner', 'memory', ['stack']).granted).toBe(true);
    });
});

// ═══════════════════════════════════════════════════
// 4. Bulk Predicates
// ═══════════════════════════════════════════════════

describe('canAll', () => {
    it('grants when role has all capabilities', () => {
        const result = canAll('owner', ['template:create', 'template:edit']);
        expect(result.granted).toBe(true);
    });

    it('denies on first missing capability', () => {
        const result = canAll('viewer', ['template:view', 'template:edit']);
        expect(result.granted).toBe(false);
        if (!result.granted) {
            expect(result.code).toBe('insufficient_role');
        }
    });

    it('grants on empty list', () => {
        expect(canAll('viewer', []).granted).toBe(true);
    });
});

describe('canAny', () => {
    it('grants when role has any capability', () => {
        const result = canAny('maintainer', ['draft:publish', 'draft:create']);
        expect(result.granted).toBe(true);
    });

    it('denies when role has none', () => {
        const result = canAny('viewer', ['template:create', 'template:edit']);
        expect(result.granted).toBe(false);
    });

    it('denies on empty list', () => {
        const result = canAny('owner', []);
        expect(result.granted).toBe(false);
    });
});

// ═══════════════════════════════════════════════════
// 5. Matrix Exhaustiveness (Domain Tests)
// ═══════════════════════════════════════════════════

describe('isAllowed — Domain: Template', () => {
    it('only owner can create template', () => {
        expect(isAllowed('owner', 'template:create')).toBe(true);
        expect(isAllowed('instructor', 'template:create')).toBe(false);
        expect(isAllowed('maintainer', 'template:create')).toBe(false);
        expect(isAllowed('viewer', 'template:create')).toBe(false);
    });

    it('owner and instructor can edit template', () => {
        expect(isAllowed('owner', 'template:edit')).toBe(true);
        expect(isAllowed('instructor', 'template:edit')).toBe(true);
        expect(isAllowed('maintainer', 'template:edit')).toBe(false);
        expect(isAllowed('viewer', 'template:edit')).toBe(false);
    });

    it('only owner can reset/delete template', () => {
        for (const cap of ['template:reset', 'template:delete'] as GovernanceCapability[]) {
            expect(isAllowed('owner', cap)).toBe(true);
            expect(isAllowed('instructor', cap)).toBe(false);
        }
    });

    it('all roles can view template', () => {
        for (const role of ALL_ROLES) {
            expect(isAllowed(role, 'template:view')).toBe(true);
        }
    });

    it('owner and instructor can view history', () => {
        expect(isAllowed('owner', 'template:view_history')).toBe(true);
        expect(isAllowed('instructor', 'template:view_history')).toBe(true);
        expect(isAllowed('maintainer', 'template:view_history')).toBe(false);
        expect(isAllowed('viewer', 'template:view_history')).toBe(false);
    });
});

describe('isAllowed — Domain: Draft', () => {
    it('owner, instructor, maintainer can create/edit/submit', () => {
        for (const cap of ['draft:create', 'draft:edit', 'draft:submit'] as GovernanceCapability[]) {
            expect(isAllowed('owner', cap)).toBe(true);
            expect(isAllowed('instructor', cap)).toBe(true);
            expect(isAllowed('maintainer', cap)).toBe(true);
            expect(isAllowed('viewer', cap)).toBe(false);
        }
    });

    it('only owner and instructor can publish/reject', () => {
        for (const cap of ['draft:publish', 'draft:reject'] as GovernanceCapability[]) {
            expect(isAllowed('owner', cap)).toBe(true);
            expect(isAllowed('instructor', cap)).toBe(true);
            expect(isAllowed('maintainer', cap)).toBe(false);
        }
    });
});

describe('isAllowed — Domain: Role', () => {
    it('only owner manages membership', () => {
        for (const cap of ['role:assign', 'role:remove_member', 'role:invite'] as GovernanceCapability[]) {
            expect(isAllowed('owner', cap)).toBe(true);
            expect(isAllowed('instructor', cap)).toBe(false);
            expect(isAllowed('viewer', cap)).toBe(false);
        }
    });
});

describe('isAllowed — Domain: Panel', () => {
    it('owner and instructor can lock/unlock/force_sync', () => {
        for (const cap of ['panel:lock', 'panel:unlock', 'panel:force_sync'] as GovernanceCapability[]) {
            expect(isAllowed('owner', cap)).toBe(true);
            expect(isAllowed('instructor', cap)).toBe(true);
            expect(isAllowed('maintainer', cap)).toBe(false);
            expect(isAllowed('viewer', cap)).toBe(false);
        }
    });
});

describe('isAllowed — Domain: Override', () => {
    it('all roles can modify/reset own', () => {
        for (const role of ALL_ROLES) {
            expect(isAllowed(role, 'override:modify_own')).toBe(true);
            expect(isAllowed(role, 'override:reset_own')).toBe(true);
        }
    });
});

describe('isAllowed — Domain: Audit', () => {
    it('owner and instructor can view, only owner can export', () => {
        expect(isAllowed('owner', 'audit:view')).toBe(true);
        expect(isAllowed('instructor', 'audit:view')).toBe(true);
        expect(isAllowed('maintainer', 'audit:view')).toBe(false);
        expect(isAllowed('owner', 'audit:export')).toBe(true);
        expect(isAllowed('instructor', 'audit:export')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════
// 6. Legacy Predicates
// ═══════════════════════════════════════════════════

describe('checkPermission', () => {
    it('returns permitted true for allowed', () => {
        expect(checkPermission('owner', 'template:edit').permitted).toBe(true);
    });

    it('returns permitted false with reason', () => {
        const result = checkPermission('viewer', 'template:edit');
        expect(result.permitted).toBe(false);
        if (!result.permitted) {
            expect(result.reason).toContain('viewer');
        }
    });
});

describe('permittedActions', () => {
    it('owner has 21 capabilities', () => {
        expect(permittedActions('owner').length).toBe(21);
    });

    it('instructor has 14 capabilities', () => {
        expect(permittedActions('instructor').length).toBe(14);
    });

    it('maintainer has 6 capabilities', () => {
        expect(permittedActions('maintainer').length).toBe(6);
    });

    it('viewer has 3 capabilities', () => {
        const caps = permittedActions('viewer');
        expect(caps.length).toBe(3);
        expect(caps).toContain('template:view');
        expect(caps).toContain('override:modify_own');
        expect(caps).toContain('override:reset_own');
    });
});

describe('createMembership', () => {
    it('creates a membership record', () => {
        const m = createMembership('proj1', 'user1', 'instructor', 'owner1', '2026-01-01T00:00:00Z');
        expect(m.projectId).toBe('proj1');
        expect(m.role).toBe('instructor');
    });
});
