// ─────────────────────────────────────────────
// Server-Side Capability Matrix
// ─────────────────────────────────────────────
// Mirrors governance-core permissions but is
// independently hardcoded on the server.
// Never trust client-reported role.
// ─────────────────────────────────────────────

import type { ProjectRole } from "../modules/projects/project.types";

export type Capability =
    | "CREATE_TEMPLATE"
    | "EDIT_TEMPLATE"
    | "PUBLISH_TEMPLATE"
    | "ASSIGN_ROLE"
    | "MODIFY_OVERRIDE"
    | "LOCK_PANEL"
    | "CREATE_SNAPSHOT"
    | "VIEW_PROJECT"
    | "EDIT_SOURCE"
    | "VIEW_MEMBERS";

/** Capability → roles that have it */
const CAPABILITY_MATRIX: Record<Capability, readonly ProjectRole[]> = {
    CREATE_TEMPLATE: ["owner", "instructor"],
    EDIT_TEMPLATE: ["owner", "instructor"],
    PUBLISH_TEMPLATE: ["owner"],
    ASSIGN_ROLE: ["owner"],
    MODIFY_OVERRIDE: ["owner", "instructor", "maintainer", "viewer"],
    LOCK_PANEL: ["owner", "instructor"],
    CREATE_SNAPSHOT: ["owner", "instructor", "maintainer"],
    VIEW_PROJECT: ["owner", "instructor", "maintainer", "viewer"],
    EDIT_SOURCE: ["owner", "instructor", "maintainer"],
    VIEW_MEMBERS: ["owner", "instructor"],
};

export function hasCapability(role: ProjectRole, capability: Capability): boolean {
    return CAPABILITY_MATRIX[capability]?.includes(role) ?? false;
}

export function getCapabilities(role: ProjectRole): Capability[] {
    return (Object.keys(CAPABILITY_MATRIX) as Capability[]).filter(
        (cap) => CAPABILITY_MATRIX[cap].includes(role),
    );
}

export const VALID_ROLES: readonly ProjectRole[] = ["owner", "instructor", "maintainer", "viewer"];

export function isValidRole(role: string): role is ProjectRole {
    return VALID_ROLES.includes(role as ProjectRole);
}
