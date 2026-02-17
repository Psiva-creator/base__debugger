// ─────────────────────────────────────────────
// chronovm-governance — Role & Permission Types
// ─────────────────────────────────────────────
// Pure type definitions and permission predicate functions.
// Zero runtime dependencies. No mutation. No IO.
// ─────────────────────────────────────────────

// ── Panel & View Types (canonical source) ──

/** The 7 ChronoVM panels. */
export type PanelId =
    | 'memory'
    | 'controlFlow'
    | 'variables'
    | 'stack'
    | 'instructions'
    | 'narration'
    | 'output';

/** Display modes per panel. */
export type ViewMode = 'learning' | 'pro';

/** A complete mapping of every panel to its mode. */
export type PanelModeMap = Readonly<Record<PanelId, ViewMode>>;

export const ALL_PANELS: readonly PanelId[] = [
    'memory',
    'controlFlow',
    'variables',
    'stack',
    'instructions',
    'narration',
    'output',
] as const;

export const DEFAULT_PANEL_MODES: PanelModeMap = {
    memory: 'learning',
    controlFlow: 'learning',
    variables: 'learning',
    stack: 'learning',
    instructions: 'learning',
    narration: 'learning',
    output: 'learning',
};

const ALL_PANELS_SET: ReadonlySet<string> = new Set(ALL_PANELS);

export const ALL_VIEW_MODES: readonly ViewMode[] = ['learning', 'pro'] as const;

const ALL_VIEW_MODES_SET: ReadonlySet<string> = new Set(ALL_VIEW_MODES);

/** Runtime check — is this a valid PanelId? */
export function isValidPanelId(value: string): value is PanelId {
    return ALL_PANELS_SET.has(value);
}

/** Runtime check — is this a valid ViewMode? */
export function isValidViewMode(value: string): value is ViewMode {
    return ALL_VIEW_MODES_SET.has(value);
}

// ── Role Types ──

/** Project-scoped role assigned to each user. */
export type ProjectRole = 'owner' | 'instructor' | 'maintainer' | 'viewer';

/**
 * Atomic governance capabilities — 21 capabilities across 6 domains.
 * Each capability has exactly one responsibility and no capability implies another.
 */
export type GovernanceCapability =
    // Domain: Template
    | 'template:create'
    | 'template:edit'
    | 'template:reset'
    | 'template:delete'
    | 'template:view'
    | 'template:view_history'
    // Domain: Draft
    | 'draft:create'
    | 'draft:edit'
    | 'draft:submit'
    | 'draft:publish'
    | 'draft:reject'
    // Domain: Role
    | 'role:assign'
    | 'role:remove_member'
    | 'role:invite'
    // Domain: Panel
    | 'panel:lock'
    | 'panel:unlock'
    | 'panel:force_sync'
    // Domain: Override
    | 'override:modify_own'
    | 'override:reset_own'
    // Domain: Audit
    | 'audit:view'
    | 'audit:export';

/** @deprecated Use GovernanceCapability instead. */
export type GovernanceAction = GovernanceCapability;

// ── Permission Matrix ──

const PERMISSION_MATRIX: Readonly<Record<GovernanceCapability, readonly ProjectRole[]>> = {
    // Template
    'template:create': ['owner'],
    'template:edit': ['owner', 'instructor'],
    'template:reset': ['owner'],
    'template:delete': ['owner'],
    'template:view': ['owner', 'instructor', 'maintainer', 'viewer'],
    'template:view_history': ['owner', 'instructor'],
    // Draft
    'draft:create': ['owner', 'instructor', 'maintainer'],
    'draft:edit': ['owner', 'instructor', 'maintainer'],
    'draft:submit': ['owner', 'instructor', 'maintainer'],
    'draft:publish': ['owner', 'instructor'],
    'draft:reject': ['owner', 'instructor'],
    // Role
    'role:assign': ['owner'],
    'role:remove_member': ['owner'],
    'role:invite': ['owner'],
    // Panel
    'panel:lock': ['owner', 'instructor'],
    'panel:unlock': ['owner', 'instructor'],
    'panel:force_sync': ['owner', 'instructor'],
    // Override
    'override:modify_own': ['owner', 'instructor', 'maintainer', 'viewer'],
    'override:reset_own': ['owner', 'instructor', 'maintainer', 'viewer'],
    // Audit
    'audit:view': ['owner', 'instructor'],
    'audit:export': ['owner'],
};

// ── Runtime Validation Guards ──

const ALL_ROLES_SET: ReadonlySet<string> = new Set<string>([
    'owner', 'instructor', 'maintainer', 'viewer',
]);

const ALL_CAPABILITIES_SET: ReadonlySet<string> = new Set<string>(
    Object.keys(PERMISSION_MATRIX),
);

/** Runtime check — is this a valid ProjectRole? */
export function isValidRole(value: string): value is ProjectRole {
    return ALL_ROLES_SET.has(value);
}

/** Runtime check — is this a valid GovernanceCapability? */
export function isValidCapability(value: string): value is GovernanceCapability {
    return ALL_CAPABILITIES_SET.has(value);
}

// ── Permission Result Types ──

export type PermissionDenialCode =
    | 'unknown_role'
    | 'unknown_capability'
    | 'insufficient_role'
    | 'panel_locked'
    | 'context_denied';

export type PermissionResult =
    | { granted: true }
    | { granted: false; code: PermissionDenialCode; reason: string };

export interface PermissionContext {
    readonly panelId?: PanelId;
    readonly lockedPanels?: readonly PanelId[];
}

// ── Unified Predicate Engine ──

/**
 * Single entry point for all permission checks.
 *
 * - Pure function — no side effects, no IO, deterministic.
 * - Never throws — returns a typed result.
 * - Deny-by-default — unknown inputs are rejected.
 * - Optional context for per-panel checks.
 */
export function can(
    role: string,
    capability: string,
    context?: PermissionContext,
): PermissionResult {
    // Guard: unknown role
    if (!isValidRole(role)) {
        return {
            granted: false,
            code: 'unknown_role',
            reason: `Unknown role: '${role}'`,
        };
    }

    // Guard: unknown capability
    if (!isValidCapability(capability)) {
        return {
            granted: false,
            code: 'unknown_capability',
            reason: `Unknown capability: '${capability}'`,
        };
    }

    // Matrix lookup
    const allowed = PERMISSION_MATRIX[capability];
    if (!allowed.includes(role)) {
        return {
            granted: false,
            code: 'insufficient_role',
            reason: `Role '${role}' is not permitted to perform '${capability}'`,
        };
    }

    // Context: per-panel lock check
    if (context?.panelId && context?.lockedPanels) {
        if (context.lockedPanels.includes(context.panelId)) {
            return {
                granted: false,
                code: 'panel_locked',
                reason: `Panel '${context.panelId}' is locked`,
            };
        }
    }

    return { granted: true };
}

// ── Per-Panel Check ──

/**
 * Check whether a role can modify a specific panel's override.
 * Combines `override:modify_own` permission with lock enforcement.
 */
export function canModifyPanel(
    role: ProjectRole,
    panelId: PanelId,
    lockedPanels: readonly PanelId[],
): PermissionResult {
    return can(role, 'override:modify_own', { panelId, lockedPanels });
}

// ── Bulk Predicates ──

/**
 * Check whether a role has ALL of the listed capabilities. Fails on first denial.
 */
export function canAll(
    role: string,
    capabilities: readonly string[],
): PermissionResult {
    for (const cap of capabilities) {
        const result = can(role, cap);
        if (!result.granted) return result;
    }
    return { granted: true };
}

/**
 * Check whether a role has ANY of the listed capabilities. Passes on first grant.
 */
export function canAny(
    role: string,
    capabilities: readonly string[],
): PermissionResult {
    let lastDenial: PermissionResult = {
        granted: false,
        code: 'insufficient_role',
        reason: `Role '${role}' has none of the requested capabilities`,
    };
    for (const cap of capabilities) {
        const result = can(role, cap);
        if (result.granted) return result;
        lastDenial = result;
    }
    return lastDenial;
}

// ── Legacy Predicates (backwards-compatible) ──

/**
 * Check whether `role` is allowed to perform `capability`.
 * Pure function — no side effects.
 */
export function isAllowed(role: ProjectRole, capability: GovernanceCapability): boolean {
    return can(role, capability).granted;
}

/**
 * Assert permission. Returns a typed result instead of throwing.
 */
export function checkPermission(
    role: ProjectRole,
    capability: GovernanceCapability,
): { permitted: true } | { permitted: false; reason: string } {
    const result = can(role, capability);
    if (result.granted) {
        return { permitted: true };
    }
    return {
        permitted: false,
        reason: result.reason,
    };
}

/**
 * Return all capabilities a given role can perform.
 */
export function permittedActions(role: ProjectRole): readonly GovernanceCapability[] {
    const capabilities: GovernanceCapability[] = [];
    for (const [cap, roles] of Object.entries(PERMISSION_MATRIX)) {
        if ((roles as readonly string[]).includes(role)) {
            capabilities.push(cap as GovernanceCapability);
        }
    }
    return capabilities;
}

// ── Membership ──

export interface ProjectMembership {
    readonly projectId: string;
    readonly userId: string;
    readonly role: ProjectRole;
    readonly assignedBy: string;
    readonly assignedAt: string; // ISO8601
}

/**
 * Create a new membership record. Pure factory.
 */
export function createMembership(
    projectId: string,
    userId: string,
    role: ProjectRole,
    assignedBy: string,
    assignedAt: string,
): ProjectMembership {
    return { projectId, userId, role, assignedBy, assignedAt };
}
