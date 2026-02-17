// ─────────────────────────────────────────────
// Tests — Security Invariants & Negative Cases
// ─────────────────────────────────────────────
// These tests enforce structural guarantees, not
// individual capability checks. If any of these
// fail, the permission system has a security flaw.
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    can,
    canModifyPanel,
    canAll,
    canAny,
    isAllowed,
    isValidRole,
    isValidCapability,
    permittedActions,
    ALL_PANELS,
} from '../src/roles.ts';
import type { ProjectRole, GovernanceCapability, PanelId } from '../src/roles.ts';

const ALL_ROLES: ProjectRole[] = ['owner', 'instructor', 'maintainer', 'viewer'];

// ═══════════════════════════════════════════════════
// 1. STRUCTURAL INVARIANTS
// ═══════════════════════════════════════════════════

describe('Invariant: completeness', () => {
    it('every capability is granted to at least one role', () => {
        // Get all capabilities via owner (who has all 21)
        const ownerCaps = permittedActions('owner');
        expect(ownerCaps.length).toBe(21);

        for (const cap of ownerCaps) {
            const hasAtLeastOneRole = ALL_ROLES.some(r => isAllowed(r, cap));
            expect(hasAtLeastOneRole).toBe(true);
        }
    });

    it('every role has at least one capability', () => {
        for (const role of ALL_ROLES) {
            expect(permittedActions(role).length).toBeGreaterThan(0);
        }
    });

    it('permission counts are exact and stable', () => {
        expect(permittedActions('owner').length).toBe(21);
        expect(permittedActions('instructor').length).toBe(14);
        expect(permittedActions('maintainer').length).toBe(6);
        expect(permittedActions('viewer').length).toBe(3);
    });
});

describe('Invariant: no privilege escalation', () => {
    it('viewer capabilities are a strict subset of maintainer', () => {
        const viewerCaps = new Set(permittedActions('viewer'));
        const maintainerCaps = new Set(permittedActions('maintainer'));
        for (const cap of viewerCaps) {
            expect(maintainerCaps.has(cap)).toBe(true);
        }
        expect(maintainerCaps.size).toBeGreaterThan(viewerCaps.size);
    });

    it('maintainer capabilities are a strict subset of instructor', () => {
        const maintainerCaps = new Set(permittedActions('maintainer'));
        const instructorCaps = new Set(permittedActions('instructor'));
        for (const cap of maintainerCaps) {
            expect(instructorCaps.has(cap)).toBe(true);
        }
        expect(instructorCaps.size).toBeGreaterThan(maintainerCaps.size);
    });

    it('instructor capabilities are a strict subset of owner', () => {
        const instructorCaps = new Set(permittedActions('instructor'));
        const ownerCaps = new Set(permittedActions('owner'));
        for (const cap of instructorCaps) {
            expect(ownerCaps.has(cap)).toBe(true);
        }
        expect(ownerCaps.size).toBeGreaterThan(instructorCaps.size);
    });

    it('no role has more capabilities than owner', () => {
        const ownerCount = permittedActions('owner').length;
        for (const role of ALL_ROLES) {
            expect(permittedActions(role).length).toBeLessThanOrEqual(ownerCount);
        }
    });
});

describe('Invariant: deny-by-default', () => {
    it('unknown role is always denied', () => {
        const result = can('superadmin', 'template:create');
        expect(result.granted).toBe(false);
        if (!result.granted) expect(result.code).toBe('unknown_role');
    });

    it('unknown capability is always denied', () => {
        const result = can('owner', 'template:nuke');
        expect(result.granted).toBe(false);
        if (!result.granted) expect(result.code).toBe('unknown_capability');
    });

    it('empty strings are denied', () => {
        expect(can('', '').granted).toBe(false);
        expect(can('owner', '').granted).toBe(false);
        expect(can('', 'template:create').granted).toBe(false);
    });
});

describe('Invariant: locked panel enforcement', () => {
    it('locked panel denies ALL roles, including owner', () => {
        for (const role of ALL_ROLES) {
            const result = canModifyPanel(role, 'memory', ['memory']);
            expect(result.granted).toBe(false);
            if (!result.granted) expect(result.code).toBe('panel_locked');
        }
    });

    it('lock on one panel does not affect other panels', () => {
        for (const role of ALL_ROLES) {
            const result = canModifyPanel(role, 'stack', ['memory']);
            expect(result.granted).toBe(true);
        }
    });

    it('multiple locked panels are all enforced', () => {
        const locked: PanelId[] = ['memory', 'stack', 'variables'];
        for (const panel of locked) {
            const result = canModifyPanel('owner', panel, locked);
            expect(result.granted).toBe(false);
        }
        // Unlocked panel still works
        expect(canModifyPanel('owner', 'output', locked).granted).toBe(true);
    });
});

describe('Invariant: determinism', () => {
    it('same inputs produce identical results over 1000 iterations', () => {
        for (let i = 0; i < 1000; i++) {
            expect(can('owner', 'template:create').granted).toBe(true);
            expect(can('viewer', 'template:create').granted).toBe(false);
        }
    });

    it('can() never returns undefined', () => {
        const result = can('owner', 'template:create');
        expect(result).toBeDefined();
        expect(result.granted).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════
// 2. NEGATIVE TESTS (privilege escalation attempts)
// ═══════════════════════════════════════════════════

describe('Negative: viewer escalation', () => {
    it('viewer cannot edit template', () => {
        expect(can('viewer', 'template:edit').granted).toBe(false);
    });

    it('viewer cannot create/delete/reset template', () => {
        for (const cap of ['template:create', 'template:delete', 'template:reset'] as GovernanceCapability[]) {
            expect(can('viewer', cap).granted).toBe(false);
        }
    });

    it('viewer cannot access drafts', () => {
        for (const cap of ['draft:create', 'draft:edit', 'draft:submit', 'draft:publish', 'draft:reject'] as GovernanceCapability[]) {
            expect(can('viewer', cap).granted).toBe(false);
        }
    });

    it('viewer cannot manage roles', () => {
        for (const cap of ['role:assign', 'role:remove_member', 'role:invite'] as GovernanceCapability[]) {
            expect(can('viewer', cap).granted).toBe(false);
        }
    });

    it('viewer cannot lock/unlock panels', () => {
        expect(can('viewer', 'panel:lock').granted).toBe(false);
        expect(can('viewer', 'panel:unlock').granted).toBe(false);
    });

    it('viewer cannot access audit', () => {
        expect(can('viewer', 'audit:view').granted).toBe(false);
        expect(can('viewer', 'audit:export').granted).toBe(false);
    });
});

describe('Negative: maintainer escalation', () => {
    it('maintainer cannot publish draft', () => {
        expect(can('maintainer', 'draft:publish').granted).toBe(false);
    });

    it('maintainer cannot reject draft', () => {
        expect(can('maintainer', 'draft:reject').granted).toBe(false);
    });

    it('maintainer cannot edit template directly', () => {
        expect(can('maintainer', 'template:edit').granted).toBe(false);
    });

    it('maintainer cannot assign roles', () => {
        expect(can('maintainer', 'role:assign').granted).toBe(false);
    });
});

describe('Negative: instructor escalation', () => {
    it('instructor cannot create template', () => {
        expect(can('instructor', 'template:create').granted).toBe(false);
    });

    it('instructor cannot assign roles', () => {
        expect(can('instructor', 'role:assign').granted).toBe(false);
    });

    it('instructor cannot export audit', () => {
        expect(can('instructor', 'audit:export').granted).toBe(false);
    });
});

describe('Negative: locked panel override', () => {
    it('owner cannot bypass lock on override', () => {
        const result = canModifyPanel('owner', 'memory', ['memory']);
        expect(result.granted).toBe(false);
        if (!result.granted) expect(result.code).toBe('panel_locked');
    });
});

// ═══════════════════════════════════════════════════
// 3. MUTATION SAFETY (compile-time guarantee)
// ═══════════════════════════════════════════════════

describe('Mutation safety: matrix covers all capabilities', () => {
    it('PERMISSION_MATRIX key count equals GovernanceCapability literal count', () => {
        // permittedActions('owner') returns all 21 because owner has all
        // If a new capability were added to the type but not the matrix,
        // TypeScript would error at compile time (Record<GovernanceCapability, ...>)
        // This runtime check is a belt-and-suspenders guard
        const allCaps = permittedActions('owner');
        expect(allCaps.length).toBe(21);
    });

    it('all 21 capabilities are individually valid', () => {
        const expected: GovernanceCapability[] = [
            'template:create', 'template:edit', 'template:reset', 'template:delete',
            'template:view', 'template:view_history',
            'draft:create', 'draft:edit', 'draft:submit', 'draft:publish', 'draft:reject',
            'role:assign', 'role:remove_member', 'role:invite',
            'panel:lock', 'panel:unlock', 'panel:force_sync',
            'override:modify_own', 'override:reset_own',
            'audit:view', 'audit:export',
        ];
        for (const cap of expected) {
            expect(isValidCapability(cap)).toBe(true);
        }
        expect(expected.length).toBe(21);
    });
});

// ═══════════════════════════════════════════════════
// 4. ROLE DOWNGRADE SAFETY
// ═══════════════════════════════════════════════════

describe('Role downgrade safety', () => {
    it('downgraded user retains only new role capabilities', () => {
        // Simulate: instructor → viewer downgrade
        // After downgrade, user should only have viewer capabilities
        const beforeCaps = new Set(permittedActions('instructor'));
        const afterCaps = new Set(permittedActions('viewer'));

        // Things they lost
        expect(beforeCaps.has('template:edit')).toBe(true);
        expect(afterCaps.has('template:edit')).toBe(false);

        // Things they kept
        expect(afterCaps.has('override:modify_own')).toBe(true);
    });

    it('downgraded user cannot perform former capabilities', () => {
        // Was instructor, now viewer
        expect(can('viewer', 'template:edit').granted).toBe(false);
        expect(can('viewer', 'draft:publish').granted).toBe(false);
        expect(can('viewer', 'panel:lock').granted).toBe(false);
    });

    it('override data is role-independent (viewer retains override capability)', () => {
        expect(can('viewer', 'override:modify_own').granted).toBe(true);
        expect(can('viewer', 'override:reset_own').granted).toBe(true);
    });
});

// ═══════════════════════════════════════════════════
// 5. BULK PREDICATE SAFETY
// ═══════════════════════════════════════════════════

describe('Bulk predicate safety', () => {
    it('canAll fails if ANY capability is missing', () => {
        const result = canAll('viewer', ['template:view', 'template:edit']);
        expect(result.granted).toBe(false);
    });

    it('canAny passes if ANY capability is present', () => {
        const result = canAny('maintainer', ['draft:publish', 'draft:create']);
        expect(result.granted).toBe(true);
    });

    it('canAll with unknown capability fails safely', () => {
        const result = canAll('owner', ['template:create', 'template:fly']);
        expect(result.granted).toBe(false);
        if (!result.granted) expect(result.code).toBe('unknown_capability');
    });

    it('canAny with all unknown capabilities fails safely', () => {
        const result = canAny('owner', ['foo:bar', 'baz:qux']);
        expect(result.granted).toBe(false);
        if (!result.granted) expect(result.code).toBe('unknown_capability');
    });
});
