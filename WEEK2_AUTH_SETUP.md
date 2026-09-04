# Week 2: Backend Authentication Implementation

This document describes the production-quality authentication system implemented for the qa-platform NestJS API.

## Overview

The system provides:
- Email/password signup with 14-day trial orgs
- Login with refresh token rotation
- Multi-org user support (one user can belong to multiple orgs)
- RBAC with role-based permission guards
- Email verification (stateless JWT)
- Invitation acceptance with auto-login
- Enterprise SSO routing (discover endpoint)
- Comprehensive audit logging

All endpoints are prefixed with `/api/v1/`.

## Setup Steps

### 1. Seed the Plans Table

Before any signup can proceed, the `plans` table must be bootstrapped with at least a `starter` plan. This is a one-time operation:

```bash
# Using psql directly (recommended for dev/CI):
psql $DATABASE_URL -f database/seed/plans.seed.sql

# Or via the pnpm helper (if wired):
pnpm db:seed
```

This script inserts three plans (starter, pro, enterprise) with reasonable defaults. The script is idempotent—running it multiple times is safe.

### 2. Environment Configuration

The following env vars (already in `.env.example`) are used:

```
JWT_SECRET=dev-only-change-me              # Sign access tokens
JWT_REFRESH_SECRET=dev-only-change-me-too  # (not currently used, kept for future)
DATABASE_URL=...                           # Postgres connection
REDIS_URL=redis://localhost:6379           # Cache & rate limiting
API_PORT=3001                              # API server port
WEB_ORIGIN=http://localhost:3000           # CORS allowed origin
```

### 3. Run the API

```bash
pnpm --filter @qa/api dev
```

The server listens on `:3001`. All auth endpoints are at `/api/v1/auth/*`.

## Endpoints

### Signup

**POST** `/api/v1/auth/signup`

**Required Header:** `Idempotency-Key` (UUID or any unique string)

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe",
  "orgName": "Acme Corp",
  "orgSlug": "acme-corp",  // optional; auto-generated if omitted
  "dataRegion": "US"       // "US" or "EU"
}
```

**Response (always 202):**
```json
{
  "emailVerificationRequired": true
}
```

**Behavior:**
- Byte-identical response whether email is new or already registered (no enumeration oracle).
- Creates User (status=INVITED) + Organization (status=TRIAL, 14-day trial) + Membership(OWNER) atomically.
- Generates a stateless JWT email verification link (24h expiry).
- Logs the link to stdout: `[dev] verification link: http://localhost:3000/verify?token=...`
- Idempotency key cached in Redis for 24h; replay returns the same 202.

### Email Verification

**POST** `/api/v1/auth/verify-email`

```json
{
  "token": "<JWT from email link>"
}
```

**Response (200):**
```json
{
  "accessToken": "...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null,
    "status": "ACTIVE",
    "lastLoginAt": null
  },
  "orgs": [
    {
      "id": "...",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "role": "OWNER",
      "status": "TRIAL",
      "planKey": "starter",
      "dataRegion": "US",
      "permissions": ["test:read", ...],
      "entitlements": { "maxProjects": 5, ... },
      "budgetState": "OK"
    }
  ]
}
```

**Behavior:**
- Sets user status to ACTIVE.
- Returns access token + user info + orgs (auto-login).
- Sets `refresh_token` as httpOnly cookie.
- Invalid/expired token → 400 with `{ error: "TOKEN_INVALID" }`.

**Resend Verification**

**POST** `/api/v1/auth/verify-email/resend`

```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Behavior:**
- Always returns `{ ok: true }` (enumeration protection).
- If email exists and status is INVITED, logs a new verification link.

### Login

**POST** `/api/v1/auth/login`

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "accessToken": "...",
  "user": { ... },
  "orgs": [ ... ]
}
```

**Behavior:**
- Updates `user.lastLoginAt`.
- Runs argon2 verify even if user doesn't exist (timing-attack resistance).
- Rate limited: 5 failed attempts per 15 min per (email+IP) → 429.
- Returns `orgs[]` with first membership as active org (can be extended to support `orgId` query param for multi-org switching).
- Sets `refresh_token` as httpOnly cookie.
- Sets `Secure` flag only in production; disabled locally for dev.

### Refresh Token

**POST** `/api/v1/auth/refresh`

**Cookie-based (no body):**
- Reads `refresh_token` from httpOnly cookie.

**Response (200):**
```json
{
  "accessToken": "..."
}
```

**Behavior:**
- Validates refresh token exists, is not expired, and has not been revoked.
- **Token Reuse Attack:** If a token is presented twice, revokes ALL active tokens for that user and returns 401.
- Rotates the old token (sets `revokedAt = now()`).
- Issues new refresh token + cookie.
- Tokens are 30-day TTL; access tokens are 15 min.

### Logout

**POST** `/api/v1/auth/logout`

**Requires:** Valid access token (Authorization: Bearer)

**Response (204 No Content):**
- Revokes refresh token.
- Adds access token JTI to Redis denylist (15 min TTL).
- Clears `refresh_token` cookie.

### Me

**GET** `/api/v1/auth/me`

**Requires:** Valid access token

**Response (200):**
```json
{
  "user": { ... },
  "activeOrgId": "...",
  "orgs": [ ... ]
}
```

### Discover

**GET** `/api/v1/auth/discover?email=user@acme.com`

**Rate limited:** 20 requests per minute per IP.

**Response (200):**
```json
{
  "domainClaimed": true,
  "orgSlug": "acme-corp",
  "orgName": "Acme Corp",
  "mode": "SSO_REQUIRED",  // or "SSO_OPTIONAL" or "PASSWORD"
  "protocol": "SAML",      // or "OIDC" (preference: SAML > OIDC)
  "startUrl": "/api/v1/auth/sso/saml/acme-corp/start"
}
```

**or (if domain not claimed):**
```json
{
  "domainClaimed": false,
  "mode": "PASSWORD"
}
```

**Behavior:**
- Looks up domain from email address.
- If no verified `DomainClaim` exists, returns `{ domainClaimed: false, mode: "PASSWORD" }`.
- If domain is verified, returns org info.
- If SSO is enabled, returns `mode` and protocol (SAML preferred over OIDC).
- `startUrl` is a placeholder; actual SSO endpoints are Week 16 scope.

### Create Org

**POST** `/api/v1/auth/orgs`

**Requires:** Valid access token

```json
{
  "orgName": "New Org",
  "orgSlug": "new-org",     // optional
  "dataRegion": "EU"
}
```

**Response (201):**
```json
{
  "id": "...",
  "name": "New Org",
  "slug": "new-org",
  "role": "OWNER",
  "status": "TRIAL",
  "planKey": "starter",
  "dataRegion": "EU",
  "permissions": [...],
  "entitlements": {...},
  "budgetState": "OK"
}
```

**Behavior:**
- Creates a new org for the authenticated user.
- User becomes OWNER of the new org.
- Uses the `starter` plan by default.
- Atomically creates Organization + Membership + AuditLog.

### Accept Invitation

**POST** `/api/v1/invitations/accept`

```json
{
  "token": "<invitation token hash>",
  "password": "NewPassword123",    // required only if user doesn't exist
  "name": "New User"               // required only if user doesn't exist
}
```

**Response (200):**
```json
{
  "accessToken": "...",
  "user": { ... },
  "orgs": [ ... ]
}
```

**Behavior:**
- If email already has a User, creates Membership (if not exists) and auto-logs in.
- If email is new, creates User (status=ACTIVE, no password required if SSO) + Membership and auto-logs in.
- Invalid/expired token → 400.
- Sets `refresh_token` cookie.

## RBAC & Permissions

All endpoints are marked with either `@Public()` or `@RequirePermissions(...)`. Every route must be explicit.

```
VIEWER:   test:read, execution:read, issue:read, knowledge:read, usage:read
EDITOR:   VIEWER + test:write, execution:run, issue:manage, proposal:decide, knowledge:write, agent:run
ADMIN:    EDITOR + credential:write, agent:author, project:manage, member:manage, org:manage, billing:read, sso:manage, audit:read, agent:pin
OWNER:    ADMIN + project:delete, support:approve
```

Role is resolved from Membership and cached in Redis for 30 seconds.

## Security Details

### Timing-Attack Resistance

- Login always runs argon2 verification, even for non-existent users (using a dummy hash).
- Signup pads latency to ~150ms when email already exists.
- Login rate limiting returns 429, never 401, so lockout itself doesn't leak account existence.

### Token Management

- Access tokens are short-lived (15 min, HS256 with `JWT_SECRET`).
- Refresh tokens are 30-day, stored as SHA256 hash in DB (never plaintext).
- JTI (JWT ID) is unique per access token; revoked tokens are denylisted in Redis (15 min TTL).
- Refresh token reuse detection: if a token is presented after revocation, all user tokens are revoked.

### Cookie Security

- `refresh_token` is httpOnly (JS-inaccessible) and Secure (HTTPS-only in prod).
- SameSite=Strict prevents cross-site request forgery.
- Path=/api/v1/auth limits scope.

### Enumeration Protection

- Signup, login, and email resend operations use indistinguishable responses for existing vs. new accounts.
- Discover endpoint is rate-limited (20/min/IP) to prevent domain enumeration.

## Database Interactions

All database access goes through `withTenant(orgId, ...)` for org-scoped tables and `withPlatform(reason, ...)` for cross-tenant reads:

- **User, RefreshToken:** Platform (global identity, cross-org).
- **Organization, Membership, AuditLog:** Tenant (org-scoped).
- **Plan, DomainClaim:** Platform (readable cross-org for routing/defaults).
- **OrgEntitlement, IdentityProvider:** Tenant (org-scoped, accessed via withTenant).

Postgres RLS policies enforce these boundaries at the database level.

## Audit Logging

Every org-scoped action (org.created, user signup, etc.) is logged to `audit_logs`:

```
{
  "orgId": "...",
  "actorType": "USER" | "SYSTEM" | "AGENT" | "SUPPORT",
  "actorId": "...",         // null for SYSTEM
  "action": "org.created",
  "entityType": "organization",
  "entityId": "...",
  "after": {...},           // new state
  "metadata": {...}
}
```

## Entitlements

Entitlements are resolved by merging Plan defaults with org-specific `OrgEntitlement` overrides:

```json
{
  "maxProjects": 5,
  "maxUsers": 5,
  "maxTests": 100,
  "maxExecutionsPerMonth": 1000,
  "maxConcurrency": 1,
  "maxCustomAgents": 0,
  "modelTiers": ["FAST"],
  "monthlyAiBudgetUsd": 10,
  "ssoModes": ["OIDC"],
  "versionPinning": false
}
```

Resolved entitlements are cached in Redis for 5 minutes per org.

## Deferred/Stubbed Features

The following are explicitly **not** implemented in Week 2 (left as stub or noted):

1. **Real Email Delivery** – Verification links are logged to stdout. No SMTP/Sendgrid integration.
2. **SSO Endpoints** – `/auth/sso/{protocol}/{slug}/start` endpoints don't exist (Week 16). Discover endpoint returns the URL string only.
3. **Budget State Calculation** – `budgetState` is hardcoded to "OK" (Week 3+, AI Gateway scope).
4. **402 Payment Required** – PAST_DUE orgs are not blocked from login (nice-to-have, deferred).
5. **Support Access Grants** – `withSupportGrant` is stubbed; support audit logging not implemented.
6. **SCIM Provisioning** – No SCIM 2.0 user sync (enterprise feature, later).
7. **Idempotency Key Replay** – Only signup has idempotency support; refresh/login do not (can be added).

## Module Structure

```
apps/api/src/
  main.ts                          (API prefix, CORS, middleware setup)
  app.module.ts                    (imports AuthModule)
  auth/
    auth.module.ts                 (DI container: AuthService, EntitlementService, etc.)
    auth.service.ts                (signup, login, refresh, logout, verify-email, discover, createOrg)
    auth.controller.ts             (all HTTP endpoints)
    permissions.ts                 (RBAC matrix)
    guards/
      jwt-auth.guard.ts            (validates access token, checks denylist)
      permission.guard.guard.ts    (enforces role-based permissions)
    decorators/
      public.decorator.ts          (marks public endpoints)
      require-permissions.decorator.ts (lists required perms)
    dto/
      signup.dto.ts, login.dto.ts, etc. (class-validator DTOs)
  invitations/
    invitations.service.ts         (acceptInvitation logic)
    invitations.controller.ts      (POST /invitations/accept)
  entitlements/
    entitlements.service.ts        (resolve(orgId) → Entitlements)
    entitlements.schema.ts         (Zod validation)
  identity/
    identity.service.ts            (resolveRole, caching)
  common/
    redis.module.ts                (ioredis provider)
    crypto.util.ts                 (sha256, randomBytes, jitter, etc.)
```

## Dependencies Added to apps/api/package.json

```json
{
  "@nestjs/jwt": "^12.0.1",
  "@nestjs/passport": "^10.0.3",
  "argon2": "^0.31.2",
  "class-transformer": "^0.5.1",
  "class-validator": "^0.14.1",
  "cookie-parser": "^1.4.6",
  "ioredis": "^5.3.2",
  "jsonwebtoken": "^9.1.2",
  "uuid": "^9.0.1"
}
```

Plus devDependencies: `@types/cookie-parser`, `@types/jsonwebtoken`.

## Modifications to packages/db/src/tenant-context.ts

1. **PlatformOperation Union:**
   Added: `"users.read" | "users.write" | "refresh_tokens.read" | "refresh_tokens.write" | "domain_claims.read"`

2. **PLATFORM_ALLOW_LIST:**
   Added: `"user"`, `"refreshToken"`, `"domainClaim"`
   
   Rationale:
   - User is a global identity scoped by membership (RLS), not org_id.
   - RefreshToken belongs to a user, not an org.
   - DomainClaim needs cross-tenant lookup by domain for routing before org context exists.

## Development Notes

### Dev Email Verification Link

Since there's no real email provider:
```
[dev] verification link: http://localhost:3000/verify?token=<JWT>
```

The web client at `http://localhost:3000` can extract the token from the query param and POST it to `/api/v1/auth/verify-email`.

### Testing Signup

```bash
curl -X POST http://localhost:3001/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "name": "Test User",
    "orgName": "Test Org",
    "dataRegion": "US"
  }'
```

### Debugging

Enable verbose logging by setting:
```bash
export DEBUG=*
```

Console logs include auth events (signup, login, token reuse, etc.) prefixed with `[auth]` or `[dev]`.

## Next Steps (Future Weeks)

- Week 3: Budget tracking & usage metering (AI Gateway integration).
- Week 4+: Domain verification flow, invite email delivery, SCIM provisioning.
- Week 16: SSO endpoints (OIDC, SAML).
- Later: Support access grants, advanced audit trails.
