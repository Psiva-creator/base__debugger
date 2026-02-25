// ─────────────────────────────────────────────
// Project Types
// ─────────────────────────────────────────────

export type ProjectRole = "owner" | "instructor" | "maintainer" | "viewer";

export interface ProjectRow {
    id: string;
    owner_id: string;
    name: string;
    source_code: string;
    compiler_version: string;
    created_at: Date;
    updated_at: Date;
}

export interface MembershipRow {
    project_id: string;
    user_id: string;
    role: ProjectRole;
    assigned_at: Date;
}

export interface CreateProjectInput {
    name: string;
    sourceCode: string;
    compilerVersion: string;
}

export interface ProjectResponse {
    id: string;
    name: string;
    sourceCode: string;
    compilerVersion: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    role: ProjectRole;
}

export interface MemberResponse {
    userId: string;
    email: string;
    name: string | null;
    role: ProjectRole;
    assignedAt: Date;
}

export interface AddMemberInput {
    email: string;
    role: ProjectRole;
}
