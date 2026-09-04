import { SetMetadata } from "@nestjs/common";
import { Permission } from "../permissions";

export const PERMISSIONS_KEY = "REQUIRED_PERMISSIONS";

/**
 * Mark an endpoint as requiring one or more permissions.
 * Syntax: @RequirePermissions('test:read', 'org:manage')
 * The user must have ALL specified permissions (intersection).
 *
 * Pass an empty array to mark a route as authenticated but not requiring
 * specific permissions (the user just needs a valid access token).
 */
export const RequirePermissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
