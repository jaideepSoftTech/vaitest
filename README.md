# qa-platform

Autonomous AI Testing Platform — monorepo. This README documents the code in
this directory; the product spec, ERD, API contracts, and 18-week roadmap
that this scaffold implements live one level up (`../../README.md` and the
numbered `0N-*.md` planning docs).

## What's here (M0)

This is the **Week 1 / M0 scaffold** from `05-ROADMAP-18-WEEKS.md`: a
Turborepo + pnpm monorepo skeleton, Docker Compose infra, a Prisma schema
wired with row-level security, a NestJS API skeleton, and a Next.js web
skeleton. No feature logic yet — that starts Week 2+.

```
apps/
  api/            NestJS 11 — GET /health only, for now
  web/             Next.js 15 App Router + Tailwind + Storybook
packages/
  config/          shared ESLint flat config (incl. the no-bare-prisma-client rule) + tsconfig base
  db/              withTenant / withPlatform — the only door into the database
  shared/          pino logger
database/
  schema.prisma    source of truth (copied from ../../03-schema.prisma, Week-1 fixes applied)
  sql/             roles, RLS enable/policies (generated), grants — see database/scripts/gen-rls.ts
infrastructure/
  compose/         docker-compose.yml — Postgres 17+pgvector, Redis, MinIO, Ollama
  scripts/minio/   bucket bootstrap script
.github/workflows/pr.yml   CI: lint · typecheck · unit · build
```

## Running it

```bash
corepack enable                      # or: npm install -g pnpm@9.15.0
cp .env.example .env                 # works unmodified; no secrets required locally
pnpm install
pnpm db:up                           # docker compose: postgres, redis, minio, ollama
pnpm db:generate                     # prisma generate
pnpm db:migrate                      # applies database/sql/*.sql + prisma migrate deploy
pnpm dev                             # turbo dev: web (:3000) + api (:3001)
```

`pnpm ollama:warm` pulls the embedding model in the background — not required
for anything in M0.

## What's deferred past M0

These are flagged in comments at the point they're deferred, not silently
skipped:

- **`database/sql/002` through `006`** (partitioning, folder-path triggers,
  key immutability, trigram/HNSW indexes) are stub files with TODOs, not
  fabricated SQL — the source docs didn't give complete content for these
  and they need real write-volume/seed data to tune correctly (Week 3+).
- **`docker-compose.yml`** only brings up infra (postgres/redis/minio/ollama).
  The `api`/`web`/`worker`/`browser-agent` service definitions in
  `08-TEAM-SYSTEMS.md §1.6` all build from `infrastructure/docker/Dockerfile`,
  which doesn't exist yet — run the two apps directly with `pnpm dev` until
  it does.
- **`.github/workflows/pr.yml`** only has the `verify` job (lint · typecheck
  · unit · build). `integration`, `isolation`, `contract`, `images`, and
  `security` are explicitly Week 2+ in the roadmap and depend on
  infrastructure that doesn't exist yet (the isolation harness, the OpenAPI
  spec, the Dockerfile).
- **MinIO service-account scoping** (`policy-worker.json` / `policy-api.json`
  / `policy-lifecycle.json` least-privilege credentials) isn't wired up —
  `infrastructure/scripts/minio/buckets.sh` creates and encrypts the buckets
  but apps use the root MinIO credentials directly, which is fine for one
  developer's machine and not further than that.
- **`withSupportGrant`** in `packages/db` throws "not implemented" —
  lands Week 2 per the doc.

## Known limitations from verifying this scaffold

This was built and verified in a sandboxed environment without Docker and
with restricted network egress, so two things could not be exercised
end-to-end here and are worth checking on first real run:

- **Docker Compose was never actually run.** `docker-compose.yml` is written
  faithfully from `08-TEAM-SYSTEMS.md §1.6` but `docker compose up` itself
  hasn't been verified in practice.
- **`prisma generate`** couldn't reach `binaries.prisma.sh` in the sandbox
  (DNS/network block), so the generated client itself is unverified. Given a
  normal network connection this should just work — but it's the one
  `pnpm install && pnpm db:generate` step that wasn't actually exercised.

Everything else **was** verified end to end in this environment: `pnpm
install`, `pnpm lint`, `pnpm --filter @qa/web typecheck` and `build` (clean
Next.js production build), `nest build`, and both `apps/api` (`GET /health`)
and `apps/web` booting and responding on their real ports. Two real bugs
turned up and were fixed in the process — neither package had `eslint`
actually installed or wired to `packages/config`'s shared flat config
(fixed: added the dependency, an `eslint.config.js` in each app, and
`typescript-eslint` for TS parsing), and `packages/db` had no `db:generate`
script despite `turbo.json` expecting one (fixed: added
`prisma generate --schema=../../database/schema.prisma`).

One cosmetic leftover: a handful of empty `.tmp` files may exist at the repo
root from diagnosing a filesystem quirk during setup — safe to delete
whenever convenient; nothing references them.
