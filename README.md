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

## Week 2: auth, entitlements, invitations

Week 2 adds real feature logic on top of the M0 scaffold: backend auth
(signup/login/refresh/logout, email verification, org-scoped RBAC,
invitations, org discovery for SSO routing), the systems track (CI gates,
MinIO object-key conventions, the BullMQ queue contract), and the frontend
auth screens (login, signup, email verification, invite acceptance, org
creation) against a hand-authored OpenAPI mock. See `WEEK2_AUTH_SETUP.md`
for the backend API reference (endpoints, request/response shapes, setup
steps) — this section covers what changed, what was verified, and what's
still deferred.

**Before first run:** seed the plans table — `psql $DATABASE_URL -f
database/seed/plans.seed.sql` — signup fails without at least a `starter`
plan row. Verified the script's column list (`id, key, name, defaults,
tier_models, is_public, created_at, updated_at`) against `Plan` in
`database/schema.prisma`; it matches, including every field documented in
the model's `defaults`-shape comment.

### What was verified this pass

Same sandbox constraints as M0 (no Docker, restricted network egress — see
above), so this was a scratch-copy `pnpm install --ignore-scripts` +
lint/typecheck/build pass, not a live-server run. Within that scope:

- `apps/web`: `typecheck`, `lint`, `build` (real Next.js production build,
  all 7 routes compiled/prerendered) all clean.
- `apps/web`'s mock OpenAPI spec (`mocks/auth-openapi.yaml`) now actually
  validates — see bug list below.
- `apps/api`: `lint` fully clean; `typecheck` clean except for the errors
  described in "Still blocked by the sandbox" below, which are all one
  root cause.
- `packages/db`, `packages/shared`: `typecheck` clean (same one root-cause
  exception for `packages/db`).
- `pnpm env:check` (the `.env.example` ↔ `process.env.X` drift check that
  gates CI's `verify` job) passes.
- Seed SQL cross-checked against the Prisma model by hand (see above).

### Real bugs found and fixed during verification

- **`apps/api/package.json`**: `@types/cookie-parser@^1.4.11` and
  `jsonwebtoken@^9.1.2` don't exist on npm (max published versions are
  1.4.10 and 9.0.3) — `pnpm install` fails outright with these pins. Fixed
  to `^1.4.9` / `^9.0.2`.
- **`uuid@^9.0.1` doesn't export `v7`.** `auth.service.ts` and
  `invitations.service.ts` both call `uuidv7()` for every ID they generate
  (session IDs, JWT IDs, user IDs, membership IDs) — `uuid` only gained
  UUIDv7 support in v10. This would have failed at runtime on literally
  every signup, login, and invitation accept. Fixed by bumping `uuid` to
  `^11.1.0` (which ships its own types, so the `@types/uuid` devDependency
  was removed rather than added).
- **`packages/db`'s `PlatformOperation` type / `PLATFORM_ALLOW_LIST` didn't
  include invitations.** `invitations.service.ts` looks up an invitation by
  its token hash via `withPlatform("invitations.read", ...)` — necessary
  because, like the existing `domain_claims.read` case, you don't know the
  org until *after* the lookup. But `"invitations.read"` wasn't a valid
  `PlatformOperation` and `"invitation"` wasn't in the runtime allow-list,
  so this would have thrown `withPlatform: "invitation" is a tenant-scoped
  model. Use withTenant(orgId, ...) instead` on every invitation-accept
  call. Fixed by adding both, with a comment tying it to the same
  cross-tenant-lookup-before-knowing-org exception as `domainClaim`.
- **Next.js 15's async route params.** `apps/web/app/(auth)/invite/[token]/page.tsx`
  destructured `params.token` synchronously; Next 15 delivers `params` as a
  `Promise` to page components (including Client Components), which made
  `pnpm build` fail with a type error and would have broken the route at
  runtime. Fixed by typing `params: Promise<{ token: string }>` and
  unwrapping with React's `use()`.
- **`.env.example` had drifted from the frontend's actual env usage.**
  `pnpm env:check` — a CI gate — failed because `apps/web/src/shared/api/client.ts`
  reads `NEXT_PUBLIC_USE_MOCK_API` and `NEXT_PUBLIC_API_BASE_URL`,
  `apps/api/src/main.ts` reads `WEB_ORIGIN` for CORS, and
  `packages/shared/src/logger.ts` reads `LOG_LEVEL` — none of which were
  declared in `.env.example`. Added all four with the same inline
  documentation style as the rest of the file.
- **`apps/web/package.json`'s `mock:validate` script called `prism
  validate`, which doesn't exist** — the Prism CLI only has `mock` and
  `proxy` subcommands. Switched to `redocly lint` with a new
  `apps/web/.redocly.yaml` (the `minimal` ruleset — this mock spec is a
  Week-2 stopgap for local dev, not the canonical contract, so the stricter
  `recommended` ruleset's style complaints aren't worth gating on).
- A round of real (not stylistic-only) TypeScript fixes across both apps:
  `apps/web/tsconfig.json` was missing the `DOM`/`DOM.Iterable` lib (broke
  anything touching `HTMLInputElement`, `HeadersInit`, etc.); no Express
  `Request.user` type augmentation existed anywhere despite `JwtAuthGuard`
  attaching it at runtime (added `apps/api/src/types/express.d.ts`);
  `packages/db` didn't re-export the `Role` enum type consumers already
  imported; a handful of `any`-typed controller/service signatures were
  narrowed to real types now that `OrgInfo`/`UserInfo`/`DiscoverResult` are
  exported from `auth.service.ts`; NestJS DTOs needed definite-assignment
  assertions (`!:`) under `strictPropertyInitialization`; and
  `permission.guard.ts` had two real type errors (a `string | null` passed
  to `redis.set`, and `RequirePermissions`' metadata read back as `string[]`
  instead of the actual `Permission[]`).

Every fix above was applied in a scratch copy first (`pnpm install
--ignore-scripts`, since `argon2`'s native-binary postinstall is also
network-blocked in this sandbox — same class of issue as `prisma
generate`), re-verified with `typecheck`/`lint`/`build`, then ported back
into this working copy.

### Still blocked by the sandbox (not a code bug)

`packages/db`'s generated Prisma client is a 1-line stub here — `prisma
generate` can't reach `binaries.prisma.sh` (same M0-era network block noted
above). Everything that only shows up because of that stub — `Prisma`,
`PrismaClient`, and `Role` not "found" on `@prisma/client`, and a few
`Parameter 'x' implicitly has an 'any' type` errors on callback params
inside `withTenant`/`withPlatform` calls — is downstream of the missing
client, not a real bug. Confirmed by running `pnpm typecheck` before vs.
after each fix above and checking the *type* of every remaining error
matched this pattern exactly (an `@prisma/client` re-export failure or a
`tx`-derived implicit-any). Run `pnpm db:generate` on a normal network
connection and re-run `pnpm typecheck` to confirm this class clears — it
should.

`pnpm turbo run typecheck` (the root script, and what CI runs) will itself
fail in this sandbox because `db:generate` is a `dependsOn` for
`@qa/db#typecheck` in `turbo.json` — this isn't a new Week 2 problem, it's
the same network block surfacing through the task graph instead of directly.

### What's deferred past Week 2

- **SSO is routing-only.** `POST /auth/discover` returns a `startUrl`
  shape but there's no `/auth/sso/*` endpoint behind it yet — real
  SAML/OIDC lands per the roadmap (Week 16).
- **No real email is sent.** Verification and invitation emails are
  logged/stubbed, not delivered.
- **`budgetState` on `Org` is hardcoded** (`"OK"`), not computed from real
  usage.
- **`withSupportGrant`** (`packages/db`) still throws "not implemented" —
  same as noted in the M0 section; full implementation isn't Week 2 scope
  either.
- **SCIM isn't implemented** — `ssoModes` in plan defaults includes it as a
  future capability, not a working integration.
- **`.github/workflows/pr.yml`'s `contract` and `images` jobs were
  intentionally not added** — `contract` needs `packages/types/openapi.json`
  from the real backend (lands Week 3, once the hand-authored mock spec is
  replaced by a generated one); `images` needs
  `infrastructure/docker/Dockerfile`, which doesn't exist yet. Both are
  called out in the workflow file's own header comment so a future PR
  adding them isn't a surprise.
- **Branch protection** needs to be applied by hand in the GitHub UI — see
  the systems track's runbook (there's no API-only way to do this that
  doesn't also require repo-admin credentials this environment doesn't
  have).
- **MinIO service-account scoping** is still env-gated no-ops, same as M0 —
  now Week 4+ per the roadmap instead of unscheduled.
- **CODEOWNERS placeholder handles** need to be swapped for real GitHub
  usernames before branch protection's required-reviewers rule means
  anything.

### Before you push this

- `pnpm-lock.yaml` was **not** regenerated here — the scratch-copy install
  used `--ignore-scripts` (argon2's native binary can't compile without
  network access) and pnpm wasn't part of this sandbox's base image, so the
  lockfile from that install isn't a lockfile you want committed. Run
  `pnpm install` yourself once, normally, to pick up the corrected
  `uuid`/`jsonwebtoken`/`@types/cookie-parser` versions and the new
  `@redocly/cli` and regenerate the lockfile for real.
- Run `pnpm db:generate` yourself too, then re-run `pnpm typecheck` — it
  should go fully clean once the real Prisma client exists (see above).
- Two cosmetic items from setup, safe to clean up whenever convenient:
  a stray empty `_tmp_1356_...` file at the repo root (harmless, same class
  as the M0-era `.tmp` files above), and a `.git/index.lock` that this
  environment's sandboxed filesystem left behind and can't remove itself —
  delete it by hand before your next `git` command if one exists.

### If `pnpm db:generate` fails with `Command failed: pnpm add prisma@6.2.1 -D --silent`

This is Prisma's own CLI, not this repo's code: when `prisma generate` can't
resolve `prisma`/`@prisma/client` from `packages/db`'s `node_modules` (e.g. a
partial/corrupted install), it silently shells out to
`<package manager> add prisma@<version> -D --silent` to self-heal, and
`--silent` swallows the real error — you just get a bare exit code 1 with no
explanation. Common causes are a `node_modules` left over from a failed or
mixed npm/pnpm install, or a registry/proxy that the auto-install's network
call can't reach even though your normal `pnpm install` works.

Fixed here: `packages/db/package.json`'s `db:generate` script now sets
`PRISMA_GENERATE_SKIP_AUTOINSTALL=1`, which disables that self-heal entirely.
Since `prisma` and `@prisma/client` are already declared as real dependencies
and satisfied by `pnpm install`, the auto-install was always a redundant
network call — turning it off makes `db:generate` fail loudly and clearly
(`Could not resolve @prisma/client...`) instead of opaquely, if the local
install is ever genuinely broken. `prisma`'s version was also normalized from
a loose `^6.2.1` to `catalog:`, matching `@prisma/client` and the workspace
catalog exactly, so the two can't drift apart on a fresh install.

If you pull this fix and still hit a resolution error, it means
`packages/db/node_modules` itself is broken — run
`rm -rf node_modules packages/*/node_modules apps/*/node_modules
database/node_modules && pnpm install` from the repo root and retry.
