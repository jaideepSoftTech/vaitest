// packages/db/src/tenant-context.ts
//
// NOT exported from packages/db's public index (see src/index.ts). The
// ESLint rule `no-bare-prisma-client` (packages/config/eslint-rules/) makes
// importing this module, or `@prisma/client` directly, from outside
// packages/db a lint error everywhere else in the monorepo.
//
// Prisma has no concept of a per-request session variable. Every
// tenant-scoped query therefore runs inside a transaction that sets
// `app.current_org_id` first, via `SELECT set_config(..., is_local => true)`
// so the setting is scoped to that transaction and discarded on COMMIT or
// ROLLBACK. Every RLS policy in database/sql/012_rls_policies.sql reads that
// setting. This file is written once in Week 1 and is the only door into
// the database. See 07-TEAM-BACKEND.md §1.1-1.7.

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: [{ level: "warn", emit: "event" }] });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TenantTxOptions {
  timeoutMs?: number;
  maxWaitMs?: number;
  isolation?: Prisma.TransactionIsolationLevel;
}

/**
 * Runs `fn` inside a transaction whose PostgreSQL session has
 * `app.current_org_id` set to `orgId` for the duration of that transaction.
 *
 * Long-running work must not hold this open: an agent run takes minutes and
 * does not run inside one `withTenant` call — the runtime opens a short
 * `withTenant` per read and per write, and the surrounding orchestration is
 * transactionless. A `withTenant` whose callback awaits an LLM call fails
 * review (§1.7).
 */
export async function withTenant<T>(
  orgId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts: TenantTxOptions = {},
): Promise<T> {
  // Validate before it reaches set_config. current_setting('…')::uuid on an
  // empty string raises 22P02 at query time, several stack frames from the bug.
  if (!UUID_RE.test(orgId)) throw new Error(`withTenant: invalid orgId "${orgId}"`);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}::text, true)`;
      return fn(tx);
    },
    {
      timeout: opts.timeoutMs ?? 10_000,
      maxWait: opts.maxWaitMs ?? 5_000,
      isolationLevel: opts.isolation,
    },
  );
}

/**
 * Platform-plane tables only: plans, agent_tool_catalog,
 * system_agent_versions, agent_rollouts, eval_cases/runs/results. These
 * tables have no org_id and no RLS policy. The allow-list below is asserted
 * at runtime, so a tenant table reached through this door throws rather than
 * silently bypassing RLS.
 */
export type PlatformOperation =
  | "plans.read"
  | "agent_tool_catalog.read"
  | "system_agent_versions.read"
  | "system_agent_versions.write"
  | "agent_rollouts.read"
  | "agent_rollouts.write"
  | "eval.read"
  | "eval.write"
  | "users.read"
  | "users.write"
  | "refresh_tokens.read"
  | "refresh_tokens.write"
  | "domain_claims.read"
  | "invitations.read";

const PLATFORM_ALLOW_LIST = new Set<string>([
  "plan",
  "agentToolCatalog",
  "systemAgentVersion",
  "agentRollout",
  "evalCase",
  "evalRun",
  "evalResult",
  // Auth: user is a global identity (RLS scoped by membership, not org_id).
  // RefreshToken belongs to a user, not an org. DomainClaim needs cross-tenant
  // lookup by domain before knowing which org (purely for routing). Invitation
  // is otherwise a tenant-scoped, RLS-covered table (see
  // database/sql/012_rls_policies.sql), but accepting an invite means looking
  // it up by tokenHash *before* the org is known — same shape as DomainClaim.
  // Every other invitation operation (create, list, update acceptedAt) has
  // orgId in hand by then and must go through withTenant, not this door.
  "user",
  "refreshToken",
  "domainClaim",
  "invitation",
]);

export async function withPlatform<T>(
  reason: PlatformOperation,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  void reason; // surfaced in traces/audit once the agent runtime lands (BE-3).
  return prisma.$transaction(async (tx) => {
    const guarded = new Proxy(tx, {
      get(target, prop, receiver) {
        if (typeof prop === "string" && prop in target && !prop.startsWith("$")) {
          if (!PLATFORM_ALLOW_LIST.has(prop)) {
            throw new Error(
              `withPlatform: "${prop}" is a tenant-scoped model. Use withTenant(orgId, ...) instead.`,
            );
          }
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    return fn(guarded as Prisma.TransactionClient);
  });
}

/**
 * Vendor support access. Sets app.current_org_id AND app.support_grant_id
 * after verifying the grant is APPROVED and unexpired. Every statement
 * executed under it is tagged into audit_logs with actorType = SUPPORT.
 * There is no other path to a tenant's rows from a vendor session. See
 * 09-MULTI-TENANCY.md §2.7.
 *
 * Stubbed for M0: SupportAccessGrant verification lands with the
 * entitlements/support-access work in Week 2 (07-TEAM-BACKEND.md roadmap
 * row). The signature is fixed now so nothing built against it churns later.
 */
export async function withSupportGrant<T>(
  grantId: string,
  engineerEmail: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  throw new Error(
    `withSupportGrant not yet implemented (grant ${grantId}, engineer ${engineerEmail}) — ` +
      "lands with support-access grants in Week 2. See 09-MULTI-TENANCY.md §2.7.",
  );
}
