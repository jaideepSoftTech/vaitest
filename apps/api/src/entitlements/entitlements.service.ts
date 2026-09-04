import { Injectable, Inject } from "@nestjs/common";
import Redis from "ioredis";
import { withTenant, withPlatform } from "@qa/db";
import { REDIS_CLIENT } from "../common/redis.module";
import { Entitlements, EntitlementsSchema } from "./entitlements.schema";

/**
 * EntitlementService resolves effective entitlements for an org by merging
 * plan defaults with org-specific overrides (OrgEntitlement rows).
 * Results are cached in Redis for 5 minutes.
 */
@Injectable()
export class EntitlementService {
  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async resolve(orgId: string): Promise<Entitlements> {
    // Check cache first.
    const cacheKey = `ent:${orgId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch org and plan details inside tenant context.
    const merged = await withTenant(orgId, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId } });

      // Fetch plan via platform context (cross-tenant platform table).
      const plan = await withPlatform("plans.read", async (platformTx) => {
        return platformTx.plan.findUniqueOrThrow({
          where: { id: org.planId },
        });
      });

      // Start with plan defaults.
      let entitlements = typeof plan.defaults === "object" ? plan.defaults : {};

      // Fetch active org-specific overrides.
      const now = new Date();
      const overrides = await tx.orgEntitlement.findMany({
        where: {
          orgId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });

      // Shallow-merge overrides (they win).
      for (const override of overrides) {
        const value = override.value;
        if (typeof value === "object") {
          entitlements = { ...entitlements, ...value };
        }
      }

      return entitlements;
    });

    // Validate with Zod schema (throws if type mismatches).
    const validated = EntitlementsSchema.parse(merged);

    // Cache for 5 minutes.
    await this.redis.set(cacheKey, JSON.stringify(validated), "EX", 300);

    return validated;
  }
}
