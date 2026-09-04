import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import Redis from "ioredis";
import { withTenant } from "@qa/db";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { PERMISSIONS, Permission } from "../permissions";
import { REDIS_CLIENT } from "../../common/redis.module";

/**
 * PermissionGuard enforces RBAC after JWT validation.
 * Resolves user's role for the org and checks against required permissions.
 *
 * Convention:
 * - @RequirePermissions() with empty array: authenticated only, no specific perms.
 * - @RequirePermissions('test:read', 'org:manage'): must have ALL listed perms.
 * - No @RequirePermissions and no @Public: FAIL CLOSED (throws).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPerms = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @RequirePermissions decorator exists, enforce explicitly (fail closed).
    if (requiredPerms === undefined) {
      // Check if route has @Public() — if so, allow through.
      const isPublic = this.reflector.getAllAndOverride<boolean>("IS_PUBLIC", [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!isPublic) {
        throw new ForbiddenException(
          "Route requires explicit @RequirePermissions or @Public decorator",
        );
      }
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id || !user?.orgId) {
      throw new ForbiddenException("User context missing");
    }

    // Resolve the user's role for this org (with Redis cache).
    const cacheKey = `role:${user.id}:${user.orgId}`;
    let role = await this.redis.get(cacheKey);

    if (!role) {
      // Cache miss: fetch from DB inside tenant context.
      const membership = await withTenant(user.orgId, async (tx) => {
        return tx.membership.findUnique({
          where: {
            orgId_userId: {
              orgId: user.orgId,
              userId: user.id,
            },
          },
        });
      });

      if (!membership) {
        // Cross-org access: resource doesn't exist (mirrors RLS invisible row).
        throw new NotFoundException("Resource not found");
      }

      role = membership.role;
      // Cache the resolved role for 30 seconds. `role` is a required, non-null
      // column on Membership, but the redis client's return type widens our
      // local variable to `string | null` — guard defensively rather than
      // assert, since a `!` here would silently hide a real data problem.
      if (role) {
        await this.redis.set(cacheKey, role, "EX", 30);
      }
    }

    // Get all permissions for this role.
    const userPermissions = PERMISSIONS[role as keyof typeof PERMISSIONS];
    if (!userPermissions) {
      throw new ForbiddenException("Unknown role");
    }

    // If no permissions are required, allow (authenticated).
    if (requiredPerms.length === 0) {
      return true;
    }

    // Check if user has ALL required permissions.
    const hasAllPermissions = requiredPerms.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        "Insufficient permissions for this operation",
      );
    }

    return true;
  }
}
