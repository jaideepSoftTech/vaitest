import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { sign, verify } from "jsonwebtoken";
import { hash, verify as argonVerify } from "argon2";
import { v7 as uuidv7 } from "uuid";
import Redis from "ioredis";
import { withTenant, withPlatform } from "@qa/db";
import { REDIS_CLIENT } from "../common/redis.module";
import { sha256, generateRandomToken, sleep, jitter } from "../common/crypto.util";
import { EntitlementService } from "../entitlements/entitlements.service";
import { PERMISSIONS } from "./permissions";

/**
 * JWT payload shape for access tokens.
 */
interface JwtPayload {
  sub: string; // userId
  orgId: string;
  sid: string; // session id
  jti: string; // JWT ID (unique, used for denylisting)
  iat: number;
  exp: number;
}

/**
 * JWT payload shape for email verification tokens (shorter-lived, stateless).
 */
interface EmailVerificationPayload {
  sub: string; // userId
  purpose: "email_verify";
  iat: number;
  exp: number;
}

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
  planKey: string;
  dataRegion: string;
  permissions: string[];
  entitlements: Record<string, unknown>;
  budgetState: "OK" | "WARNING" | "EXCEEDED";
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  lastLoginAt: string | null;
}

export interface DiscoverResult {
  domainClaimed: boolean;
  orgSlug?: string;
  orgName?: string;
  mode?: "PASSWORD" | "SSO_OPTIONAL" | "SSO_REQUIRED";
  protocol?: "OIDC" | "SAML";
  startUrl?: string;
}

/**
 * AuthService handles all authentication flows: signup, login, refresh, logout, email verification.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    private entitlementService: EntitlementService,
  ) {}

  /**
   * POST /auth/signup
   * Creates a new org + user with a trial plan. Always returns 202.
   */
  async signup(
    email: string,
    password: string,
    name: string,
    orgName: string,
    orgSlug: string | undefined,
    dataRegion: "US" | "EU",
    idempotencyKey: string,
  ): Promise<{ emailVerificationRequired: boolean }> {
    // Check idempotency key in Redis.
    const idemKey = `idem:signup:${idempotencyKey}`;
    const cached = await this.redis.get(idemKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = { emailVerificationRequired: true };

    // Check if email already exists.
    const existingUser = await withPlatform("users.read", async (tx) => {
      return tx.user.findUnique({ where: { email } });
    });

    if (existingUser) {
      // Email already registered: pad latency and return same response.
      console.log(
        `[auth] signup: email ${email} already exists, returning standard response`,
      );
      await sleep(150 + jitter());
      await this.redis.set(idemKey, JSON.stringify(response), "EX", 86400);
      return response;
    }

    // Fetch the starter plan.
    const plan = await withPlatform("plans.read", async (tx) => {
      return tx.plan.findUnique({ where: { key: "starter" } });
    });

    if (!plan) {
      throw new UnprocessableEntityException(
        "Default plan (starter) not found. Run database seed.",
      );
    }

    // Generate UUIDs for user and org.
    const userId = uuidv7();
    const orgId = uuidv7();

    // Hash password.
    const passwordHash = await hash(password, { type: 2 });

    // Compute trial end date (14 days from now).
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Use provided slug or auto-generate from org name (lowercase + dashes).
    const computedSlug =
      orgSlug ||
      orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    // Create everything in one transaction.
    await withTenant(orgId, async (tx) => {
      // Create organization.
      await tx.organization.create({
        data: {
          id: orgId,
          name: orgName,
          slug: computedSlug,
          planId: plan.id,
          status: "TRIAL",
          dataRegion,
          trialEndsAt,
        },
      });

      // Create user.
      await withPlatform("users.write", async (platformTx) => {
        await platformTx.user.create({
          data: {
            id: userId,
            email,
            passwordHash,
            name,
            status: "INVITED", // Not verified yet.
          },
        });
      });

      // Create membership (user is OWNER of their own org).
      await tx.membership.create({
        data: {
          id: uuidv7(),
          orgId,
          userId,
          role: "OWNER",
        },
      });

      // Create audit log.
      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          orgId,
          actorType: "SYSTEM",
          action: "org.created",
          entityType: "organization",
          entityId: orgId,
          after: { name: orgName, slug: computedSlug },
        },
      });
    });

    // Generate email verification token (stateless JWT, 24h expiry).
    const verificationToken = sign(
      { sub: userId, purpose: "email_verify" },
      process.env.JWT_SECRET || "dev-only-change-me",
      { expiresIn: "24h" },
    );

    // Log for dev (no real email provider in scope).
    console.log(
      `[dev] verification link: http://localhost:3000/verify?token=${verificationToken}`,
    );

    // Cache the idempotency response.
    await this.redis.set(idemKey, JSON.stringify(response), "EX", 86400);

    return response;
  }

  /**
   * POST /auth/login
   * Validates credentials and returns access + refresh tokens + user info.
   */
  async login(
    email: string,
    password: string,
    ipAddress: string,
  ): Promise<{
    result: {
      accessToken: string;
      user: UserInfo;
      orgs: OrgInfo[];
    };
    refreshToken: string;
  }> {
    // Rate limit: 5 attempts per 15 min per (email+IP).
    const rateLimitKey = `rl:login:${email}:${ipAddress}`;
    const attempts = await this.redis.incr(rateLimitKey);

    if (attempts === 1) {
      // First attempt: set expiry.
      await this.redis.expire(rateLimitKey, 900); // 15 minutes
    }

    if (attempts > 5) {
      throw new UnauthorizedException("Too many login attempts. Try again later.");
    }

    // Always run argon verify (even for non-existent users) to prevent timing attacks.
    const user = await withPlatform("users.read", async (tx) => {
      return tx.user.findUnique({ where: { email } });
    });

    let isValidPassword = false;

    if (user && user.passwordHash) {
      try {
        isValidPassword = await argonVerify(user.passwordHash, password);
      } catch {
        isValidPassword = false;
      }
    } else {
      // User doesn't exist or has no password hash: run dummy verify for timing.
      const dummyHash =
        "$argon2id$v=19$m=19456,t=2,p=1$MOgH6d3N2SLEXYUhJFLVTw$F3Ib8klFr3x6q9kH6vf7R7R6q9kH6vf7R7R6q9kH6vf7";
      try {
        await argonVerify(dummyHash, password);
      } catch {
        // Expected to fail.
      }
      isValidPassword = false;
    }

    if (!user || !isValidPassword) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.status === "SUSPENDED") {
      throw new UnauthorizedException("Account is suspended");
    }

    // Update lastLoginAt.
    await withPlatform("users.write", async (tx) => {
      await tx.user.update({
        where: { id: user!.id },
        data: { lastLoginAt: new Date() },
      });
    });

    // Build login response (fetches orgs, generates tokens, etc).
    const { result, refreshToken } = await this.buildLoginResponse(user.id);
    return { result, refreshToken };
  }

  /**
   * Builds the full login response: access token + user info + orgs.
   * Used by login, refresh, verify-email, and invitation-accept flows.
   */
  async buildLoginResponse(
    userId: string,
    preferredOrgId?: string,
  ): Promise<{
    result: {
      accessToken: string;
      user: UserInfo;
      orgs: OrgInfo[];
    };
    refreshToken: string;
  }> {
    // Fetch user and all memberships.
    const user = await withPlatform("users.read", async (tx) => {
      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          memberships: {
            include: {
              org: {
                include: { plan: true },
              },
            },
          },
        },
      });
    });

    // Determine active org (prefer specified, else first membership).
    const preferredMembership = preferredOrgId
      ? user.memberships.find((m) => m.org.id === preferredOrgId)
      : undefined;
    const activeOrg = preferredMembership?.org ?? user.memberships[0]?.org;

    if (!activeOrg) {
      throw new UnprocessableEntityException("User has no organization memberships");
    }

    // Build orgs array.
    const orgs = await Promise.all(
      user.memberships.map(async (m) => {
        const entitlements = await this.entitlementService.resolve(m.org.id);
        return this.buildOrgInfo(m, entitlements);
      }),
    );

    // Generate tokens.
    const sid = uuidv7();
    const jti = uuidv7();
    const accessToken = sign(
      {
        sub: user.id,
        orgId: activeOrg.id,
        sid,
        jti,
      } as JwtPayload,
      process.env.JWT_SECRET || "dev-only-change-me",
      { expiresIn: "15m" },
    );

    // Store refresh token.
    const refreshTokenPlaintext = generateRandomToken();
    const refreshTokenHash = sha256(refreshTokenPlaintext);
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await withPlatform("refresh_tokens.write", async (tx) => {
      await tx.refreshToken.create({
        data: {
          id: uuidv7(),
          userId: user.id,
          tokenHash: refreshTokenHash,
          expiresAt: refreshExpiresAt,
          userAgent: "unknown", // Set by controller from request header.
          ipAddress: "0.0.0.0", // Set by controller from request IP.
        },
      });
    });

    return {
      result: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          status: user.status,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        },
        orgs,
      },
      refreshToken: refreshTokenPlaintext,
    };
  }

  /**
   * Build a single OrgInfo object for a membership.
   *
   * Narrow local shape rather than a full Prisma payload type: this is the
   * only piece of membership/org/plan data buildOrgInfo touches, and it
   * keeps this file typecheckable even before `prisma generate` has run.
   */
  private buildOrgInfo(
    membership: {
      role: string;
      org: {
        id: string;
        name: string;
        slug: string;
        status: string;
        dataRegion: string;
        plan: { key: string };
      };
    },
    entitlements: Record<string, unknown>,
  ): OrgInfo {
    // Map role to permissions.
    const permissions = PERMISSIONS[membership.role] || [];

    return {
      id: membership.org.id,
      name: membership.org.name,
      slug: membership.org.slug,
      role: membership.role,
      status: membership.org.status,
      planKey: membership.org.plan.key,
      dataRegion: membership.org.dataRegion,
      permissions,
      entitlements,
      budgetState: "OK", // Stubbed: real budget calculation lands Week 3+ (AI Gateway).
    };
  }

  /**
   * POST /auth/refresh
   * Rotate refresh token and issue new access token.
   */
  async refresh(
    refreshTokenPlaintext: string,
  ): Promise<{
    accessToken: string;
    newRefreshToken: string;
  }> {
    const tokenHash = sha256(refreshTokenPlaintext);

    // Look up refresh token.
    const refreshToken = await withPlatform("refresh_tokens.read", async (tx) => {
      return tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
    });

    if (!refreshToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Check if token is expired.
    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    // Check if token was already revoked (reuse attack).
    if (refreshToken.revokedAt) {
      // Token reuse: revoke all active tokens for this user.
      console.log(
        `[auth] refresh: token reuse detected for user ${refreshToken.userId}`,
      );
      await withPlatform("refresh_tokens.write", async (tx) => {
        await tx.refreshToken.updateMany({
          where: {
            userId: refreshToken.userId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      });

      throw new UnauthorizedException(
        "Token reuse detected. All sessions revoked.",
      );
    }

    // Revoke the old token.
    await withPlatform("refresh_tokens.write", async (tx) => {
      await tx.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revokedAt: new Date() },
      });
    });

    // Generate new refresh token.
    const newRefreshTokenPlaintext = generateRandomToken();
    const newRefreshTokenHash = sha256(newRefreshTokenPlaintext);
    const newRefreshExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );

    await withPlatform("refresh_tokens.write", async (tx) => {
      await tx.refreshToken.create({
        data: {
          id: uuidv7(),
          userId: refreshToken.userId,
          tokenHash: newRefreshTokenHash,
          expiresAt: newRefreshExpiresAt,
          userAgent: refreshToken.userAgent,
          ipAddress: refreshToken.ipAddress,
        },
      });
    });

    // Build new access token (reuse the org from the old token if possible, else first membership).
    // For simplicity, we just resolve the first membership's org.
    const user = refreshToken.user;
    const memberships = await withPlatform("users.read", async (tx) => {
      const userWithMemberships = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { memberships: true },
      });
      return userWithMemberships.memberships;
    });

    if (memberships.length === 0) {
      throw new UnprocessableEntityException(
        "User has no organization memberships",
      );
    }

    const orgId = memberships[0].orgId;
    const sid = uuidv7();
    const jti = uuidv7();

    const accessToken = sign(
      {
        sub: user.id,
        orgId,
        sid,
        jti,
      } as JwtPayload,
      process.env.JWT_SECRET || "dev-only-change-me",
      { expiresIn: "15m" },
    );

    // Return new access token + refresh token (response object sets new cookie in controller).
    return { accessToken, newRefreshToken: newRefreshTokenPlaintext };
  }

  /**
   * POST /auth/logout
   * Revoke refresh token and add access token to denylist.
   */
  async logout(
    refreshTokenPlaintext: string | undefined,
    jti: string | undefined,
  ): Promise<void> {
    if (refreshTokenPlaintext) {
      const tokenHash = sha256(refreshTokenPlaintext);
      await withPlatform("refresh_tokens.write", async (tx) => {
        const token = await tx.refreshToken.findUnique({
          where: { tokenHash },
        });
        if (token) {
          await tx.refreshToken.update({
            where: { id: token.id },
            data: { revokedAt: new Date() },
          });
        }
      });
    }

    if (jti) {
      // Add access token JTI to denylist with TTL matching token expiry.
      // For simplicity, use a fixed 15-minute TTL (matching access token lifetime).
      await this.redis.set(`auth:denylist:${jti}`, "1", "EX", 900);
    }
  }

  /**
   * POST /auth/verify-email
   * Verify an email via stateless JWT token and auto-login the user.
   */
  async verifyEmail(token: string): Promise<{
    result: {
      accessToken: string;
      user: UserInfo;
      orgs: OrgInfo[];
    };
    refreshToken: string;
  }> {
    let payload: EmailVerificationPayload;

    try {
      payload = verify(
        token,
        process.env.JWT_SECRET || "dev-only-change-me",
      ) as EmailVerificationPayload;
    } catch {
      throw new BadRequestException("TOKEN_INVALID");
    }

    if (payload.purpose !== "email_verify") {
      throw new BadRequestException("TOKEN_INVALID");
    }

    const userId = payload.sub;

    // Set user status to ACTIVE.
    await withPlatform("users.write", async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: "ACTIVE" },
      });
    });

    // Auto-login by building the login response.
    return this.buildLoginResponse(userId);
  }

  /**
   * POST /auth/verify-email/resend
   * Resend verification email (or stub it for dev).
   */
  async resendVerificationEmail(email: string): Promise<{ ok: boolean }> {
    // Always return success (enumeration protection).
    const user = await withPlatform("users.read", async (tx) => {
      return tx.user.findUnique({ where: { email } });
    });

    if (user && user.status === "INVITED") {
      // Generate and log new token.
      const verificationToken = sign(
        { sub: user.id, purpose: "email_verify" },
        process.env.JWT_SECRET || "dev-only-change-me",
        { expiresIn: "24h" },
      );

      console.log(
        `[dev] verification link: http://localhost:3000/verify?token=${verificationToken}`,
      );
    }

    return { ok: true };
  }

  /**
   * GET /auth/discover
   * Look up a domain to discover org and SSO info.
   */
  async discover(email: string): Promise<DiscoverResult> {
    // Extract domain from email.
    const domain = email.split("@")[1];
    if (!domain) {
      return { domainClaimed: false, mode: "PASSWORD" };
    }

    // Look up verified domain claim via platform context.
    const domainClaim = await withPlatform("domain_claims.read", async (tx) => {
      return tx.domainClaim.findUnique({
        where: { domain },
        include: {
          org: {
            include: {
              identityProviders: {
                where: { enabled: true },
              },
            },
          },
        },
      });
    });

    if (!domainClaim || !domainClaim.verifiedAt) {
      return { domainClaimed: false, mode: "PASSWORD" };
    }

    // Domain is claimed and verified.
    const org = domainClaim.org;
    const idps = org.identityProviders;

    // Prefer SAML, then OIDC.
    const idp = idps.find((i) => i.protocol === "SAML") ||
      idps.find((i) => i.protocol === "OIDC") || null;

    if (!idp) {
      return {
        domainClaimed: true,
        orgSlug: org.slug,
        orgName: org.name,
        mode: "PASSWORD",
      };
    }

    const mode = domainClaim.forceSso ? "SSO_REQUIRED" : "SSO_OPTIONAL";
    const protocol = idp.protocol;

    // Note: SSO start URL is Week 16 work; endpoint doesn't exist yet.
    return {
      domainClaimed: true,
      orgSlug: org.slug,
      orgName: org.name,
      mode,
      protocol,
      startUrl: `/api/v1/auth/sso/${protocol.toLowerCase()}/${org.slug}/start`,
    };
  }

  /**
   * POST /auth/orgs
   * Create a new org for an already-authenticated user.
   */
  async createOrg(
    userId: string,
    orgName: string,
    orgSlug: string | undefined,
    dataRegion: "US" | "EU",
  ): Promise<OrgInfo> {
    // Fetch starter plan.
    const plan = await withPlatform("plans.read", async (tx) => {
      return tx.plan.findUnique({ where: { key: "starter" } });
    });

    if (!plan) {
      throw new UnprocessableEntityException(
        "Default plan (starter) not found. Run database seed.",
      );
    }

    const orgId = uuidv7();
    const computedSlug =
      orgSlug ||
      orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Create org + membership inside tenant context.
    await withTenant(orgId, async (tx) => {
      await tx.organization.create({
        data: {
          id: orgId,
          name: orgName,
          slug: computedSlug,
          planId: plan.id,
          status: "TRIAL",
          dataRegion,
          trialEndsAt,
        },
      });

      await tx.membership.create({
        data: {
          id: uuidv7(),
          orgId,
          userId,
          role: "OWNER",
        },
      });

      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          orgId,
          actorType: "USER",
          actorId: userId,
          action: "org.created",
          entityType: "organization",
          entityId: orgId,
          after: { name: orgName, slug: computedSlug },
        },
      });
    });

    // Fetch and return the new org info.
    const entitlements = await this.entitlementService.resolve(orgId);
    const membership = await withTenant(orgId, async (tx) => {
      return tx.membership.findUniqueOrThrow({
        where: {
          orgId_userId: {
            orgId,
            userId,
          },
        },
        include: {
          org: {
            include: { plan: true },
          },
        },
      });
    });

    return this.buildOrgInfo(membership, entitlements);
  }
}
