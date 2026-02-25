// ─────────────────────────────────────────────
// Snapshot Types
// ─────────────────────────────────────────────

export type SnapshotVisibility = "private" | "public";

export interface SnapshotRow {
    id: string;
    project_id: string;
    created_by: string;
    visibility: SnapshotVisibility;
    source_code: string;
    compiler_version: string;
    template_snapshot: Record<string, unknown>;
    override_snapshot: Record<string, unknown> | null;
    execution_hash: string;
    snapshot_hash: string;
    micro_index: number;
    created_at: Date;
}

export interface SnapshotResponse {
    id: string;
    projectId: string;
    createdBy: string;
    visibility: SnapshotVisibility;
    sourceCode: string;
    compilerVersion: string;
    templateSnapshot: Record<string, unknown>;
    overrideSnapshot: Record<string, unknown> | null;
    executionHash: string;
    snapshotHash: string;
    microIndex: number;
    createdAt: Date;
}

export interface CreateSnapshotInput {
    microIndex: number;
    executionHash: string;
}

export interface VisibilityInput {
    visibility: SnapshotVisibility;
}
