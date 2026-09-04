import { Injectable, Inject } from "@nestjs/common";
import Redis from "ioredis";
import { withTenant } from "@qa/db";
import { REDIS_CLIENT } from "../common/redis.module";

/**
 * IdentityService resolves user roles and other identity-related queries.
 * All lookups are cached in Redis with appropriate TTLs.
 */
@Injectable()
export class IdentityService {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  /**
   * Resolve a user's role for an org (from cache or DB).
   * Returns the Role or null if no membership exists.
   */
  async resolveRole(userId: string, orgId: string): Promise<string | null> {
    const cacheKey = `role:${userId}:${orgId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return cached;
    }

    const membership = await withTenant(orgId, async (tx) => {
      return tx.membership.findUnique({
        where: {
          orgId_userId: {
            orgId,
            userId,
          },
        },
      });
    });

    if (!membership) {
      return null;
    }

    // Cache for 30 seconds.
    await this.redis.set(cacheKey, membership.role, "EX", 30);
    return membership.role;
  }
}
