// ─────────────────────────────────────────────
// chronovm-governance — Public API
// ─────────────────────────────────────────────

// ── Roles & Permissions ──
export type {
    PanelId,
    ViewMode,
    PanelModeMap,
    ProjectRole,
    GovernanceCapability,
    GovernanceAction,
    PermissionDenialCode,
    PermissionResult,
    PermissionContext,
    ProjectMembership,
} from './roles.ts';

export {
    ALL_PANELS,
    DEFAULT_PANEL_MODES,
    ALL_VIEW_MODES,
    isValidPanelId,
    isValidViewMode,
    isValidRole,
    isValidCapability,
    can,
    canModifyPanel,
    canAll,
    canAny,
    isAllowed,
    checkPermission,
    permittedActions,
    createMembership,
} from './roles.ts';

// ── Template ──
export type {
    ProjectTemplateLayout,
    TemplateUpdateInput,
    TemplateUpdateResult,
    TemplateDiff,
    VersionConflict,
    ReconstructionResult,
    RollbackResult,
    RollbackOutcome,
} from './template.ts';

export {
    createTemplate,
    updateTemplate,
    resetTemplate,
    diffTemplates,
    VERSION_INCREMENT_TRIGGERS,
    VERSION_NO_INCREMENT_ACTIONS,
    shouldIncrementVersion,
    validateVersionForUpdate,
    publishDraft,
    rollbackTemplate,
    verifyVersionIntegrity,
    reconstructTemplateAtVersion,
    performRollback,
    verifyRollbackIntegrity,
} from './template.ts';

// ── User Overrides & Merge ──
export type {
    UserLayoutOverride,
    VersionComparison,
    RebaseResult,
    MergeWarningCode,
    MergeWarning,
    MergeResult,
} from './overrides.ts';

export {
    createOverride,
    setOverride,
    clearOverride,
    clearAllOverrides,
    compareVersions,
    rebaseOverrides,
    rebaseAndResolveConflict,
    validateMergeInputs,
    resolveLayoutWithValidation,
    resolveLayout,
} from './overrides.ts';

// ── Audit ──
export type {
    AuditAction,
    AuditDelta,
    LayoutAuditEntry,
} from './audit.ts';

export {
    ALL_AUDIT_ACTIONS,
    isValidAuditAction,
    createAuditEntry,
    createAuditEntryFromDelta,
    computeAuditDelta,
    validateAuditEntry,
    verifyLogIntegrity,
} from './audit.ts';

// ── Sync ──
export type { SyncStatus } from './sync.ts';

export {
    mergeOverrides,
    compareSyncState,
} from './sync.ts';
