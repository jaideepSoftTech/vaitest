import { Role } from "@qa/db";

export type Permission =
  | "test:read"
  | "test:write"
  | "execution:read"
  | "execution:run"
  | "issue:read"
  | "issue:manage"
  | "knowledge:read"
  | "knowledge:write"
  | "usage:read"
  | "proposal:decide"
  | "agent:run"
  | "credential:write"
  | "agent:author"
  | "project:manage"
  | "project:delete"
  | "member:manage"
  | "org:manage"
  | "billing:read"
  | "sso:manage"
  | "audit:read"
  | "agent:pin"
  | "support:approve";

/**
 * RBAC permission matrix. Roles are cumulative supersets:
 * VIEWER < EDITOR < ADMIN < OWNER.
 * EDITOR/VIEWER do not get management permissions.
 */
export const PERMISSIONS: Record<Role, Permission[]> = {
  VIEWER: [
    "test:read",
    "execution:read",
    "issue:read",
    "knowledge:read",
    "usage:read",
  ],
  EDITOR: [
    // VIEWER perms
    "test:read",
    "execution:read",
    "issue:read",
    "knowledge:read",
    "usage:read",
    // + EDITOR-only
    "test:write",
    "execution:run",
    "issue:manage",
    "proposal:decide",
    "knowledge:write",
    "agent:run",
  ],
  ADMIN: [
    // EDITOR perms
    "test:read",
    "execution:read",
    "issue:read",
    "knowledge:read",
    "usage:read",
    "test:write",
    "execution:run",
    "issue:manage",
    "proposal:decide",
    "knowledge:write",
    "agent:run",
    // + ADMIN-only
    "credential:write",
    "agent:author",
    "project:manage",
    "member:manage",
    "org:manage",
    "billing:read",
    "sso:manage",
    "audit:read",
    "agent:pin",
  ],
  OWNER: [
    // ADMIN perms
    "test:read",
    "execution:read",
    "issue:read",
    "knowledge:read",
    "usage:read",
    "test:write",
    "execution:run",
    "issue:manage",
    "proposal:decide",
    "knowledge:write",
    "agent:run",
    "credential:write",
    "agent:author",
    "project:manage",
    "member:manage",
    "org:manage",
    "billing:read",
    "sso:manage",
    "audit:read",
    "agent:pin",
    // + OWNER-only
    "project:delete",
    "support:approve",
  ],
};
