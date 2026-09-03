// packages/db/src/index.ts — the ONLY door into the database for every
// other package and app in this monorepo. Deliberately does not re-export
// the raw PrismaClient or the module that constructs it; see tenant-context.ts.

export { withTenant, withPlatform, withSupportGrant } from "./tenant-context";
export type { TenantTxOptions, PlatformOperation } from "./tenant-context";
export type { TxFor } from "./facade";

// Re-exporting generated model/enum types is safe and expected — it's the
// value under `@prisma/client` that is banned, not its types.
export type { Prisma } from "@prisma/client";
