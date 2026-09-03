#!/usr/bin/env tsx
/**
 * Concatenates database/sql/*.sql onto the end of Prisma's generated
 * migration.sql, in the fixed order 08-TEAM-SYSTEMS.md §3.1 specifies:
 * extensions → roles → RLS enable/force → policies → grants → the schema
 * defect fixes → partitioning/triggers/indexes.
 *
 * Usage: `pnpm db:migrate:dev` runs `prisma migrate dev --create-only` first
 * (so Prisma writes the CREATE TABLEs into a fresh migration directory),
 * then this script appends the ops SQL, then `prisma migrate dev` applies
 * the combined file. See database/README.md.
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ORDER = [
  "001_extensions.sql",
  "010_roles.sql",
  "011_rls_enable.sql",
  "012_rls_policies.sql",
  "013_grants.sql",
  "014_usage_records_nulls_not_distinct.sql",
  "002_partitioning.sql",
  "003_partition_ops.sql",
  "004_triggers_key_immutability.sql",
  "005_triggers_folder_path.sql",
  "006_indexes_trgm_hnsw.sql",
];

function main() {
  const migrationSqlPath = process.argv[2];
  if (!migrationSqlPath || !existsSync(migrationSqlPath)) {
    console.error(
      "Usage: tsx build-migration.ts <path-to-prisma-generated-migration.sql>\n" +
        "Run `prisma migrate dev --create-only --schema database/schema.prisma` first.",
    );
    process.exit(1);
  }

  const sqlDir = join(__dirname, "..", "sql");
  let appended = 0;
  for (const file of ORDER) {
    const full = join(sqlDir, file);
    if (!existsSync(full)) {
      console.warn(`[build-migration] skipping missing ${file}`);
      continue;
    }
    const contents = readFileSync(full, "utf8");
    appendFileSync(migrationSqlPath, `\n-- ==== ${file} ====\n${contents}\n`);
    appended++;
  }
  console.log(`[build-migration] appended ${appended} files to ${migrationSqlPath}`);
}

main();
