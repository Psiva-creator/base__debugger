// ─────────────────────────────────────────────
// Template Types
// ─────────────────────────────────────────────

export interface PanelModes {
    [panelId: string]: string;
}

export interface LockedPanels {
    [panelId: string]: boolean;
}

export interface TemplateRow {
    id: string;
    project_id: string;
    layout_version: number;
    panel_modes: PanelModes;
    locked_panels: LockedPanels;
    template_hash: string;
    previous_hash: string | null;
    updated_by: string | null;
    created_at: Date;
}

export interface TemplateResponse {
    id: string;
    projectId: string;
    layoutVersion: number;
    panelModes: PanelModes;
    lockedPanels: LockedPanels;
    templateHash: string;
    previousHash: string | null;
    updatedBy: string | null;
    createdAt: Date;
}

export interface UpdateTemplateInput {
    panelModes: PanelModes;
    lockedPanels: LockedPanels;
    baseVersion: number | null;
}

export interface AuditLogRow {
    id: string;
    project_id: string;
    user_id: string;
    role: string;
    action_type: string;
    changed_keys: Record<string, unknown> | null;
    before_state: Record<string, unknown> | null;
    after_state: Record<string, unknown> | null;
    layout_version: number | null;
    previous_hash: string | null;
    hash: string;
    created_at: Date;
}
