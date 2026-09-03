// packages/db/src/facade.ts
//
// A narrow projection of TransactionClient exposing only the delegates a
// module owns. Accessing a foreign delegate is a compile error, not a review
// comment — the type-level half of the tenant-safety pairing described in
// 07-TEAM-BACKEND.md §1.4: the lint rule stops you from manufacturing a
// client; this stops you from calling a repository method against the wrong
// slice of one.
//
// Repositories do not own a client. They receive one, and the only way to
// obtain one is `withTenant`.

import type { Prisma } from "@prisma/client";

export type TxFor<K extends keyof Prisma.TransactionClient> = Pick<
  Prisma.TransactionClient,
  K | "$executeRaw" | "$queryRaw"
>;

/**
 * Example shape for a repository method, kept here as the pattern every
 * BE-owned repository in packages/domain follows from Week 1 on:
 *
 *   async function findById(tx: TxFor<'tests'>, id: string) {
 *     return tx.tests.findUniqueOrThrow({ where: { id } });
 *   }
 *
 * `findById` cannot reach `tx.issues` or `tx.executions` even though the
 * underlying object has them — TxFor<'tests'> doesn't expose those keys.
 */
