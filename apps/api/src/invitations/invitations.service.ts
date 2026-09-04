import { Injectable, Inject, BadRequestException, Scope } from "@nestjs/common";
import { withTenant, withPlatform } from "@qa/db";
import { v7 as uuidv7 } from "uuid";
import { hash } from "argon2";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../common/redis.module";
import { sha256 } from "../common/crypto.util";
import { AuthService } from "../auth/auth.service";

type LoginResponse = Awaited<ReturnType<AuthService["buildLoginResponse"]>>;

/**
 * InvitationsService handles accepting invitation tokens.
 * If the invited email has an existing User, a new Membership is created.
 * If not, a new User + Membership are created together.
 *
 * Note: AuthService is injected but only called for buildLoginResponse (no circular dependency
 * in constructor, only at runtime). Scope is DEFAULT to ensure dependency injection works.
 */
@Injectable({ scope: Scope.DEFAULT })
export class InvitationsService {
  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    private authService: AuthService,
  ) {}

  async acceptInvitation(
    token: string,
    password?: string,
    name?: string,
  ): Promise<LoginResponse> {
    // Hash the presented token to look up the invitation.
    const tokenHash = sha256(token);

    // Look up invitation via platform context (cross-org lookup).
    const invitation = await withPlatform("invitations.read", async (tx) => {
      return tx.invitation.findUnique({
        where: { tokenHash },
        include: {
          org: {
            include: {
              plan: true,
            },
          },
        },
      });
    });

    if (!invitation) {
      throw new BadRequestException("TOKEN_INVALID");
    }

    // Check expiry and acceptance status.
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException("TOKEN_EXPIRED");
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException("TOKEN_ALREADY_USED");
    }

    const orgId = invitation.orgId;

    // Check if user exists for this email.
    let user = await withPlatform("users.read", async (tx) => {
      return tx.user.findUnique({
        where: { email: invitation.email },
      });
    });

    const now = new Date();

    if (user) {
      // User exists: create membership if it doesn't already exist.
      await withTenant(orgId, async (tx) => {
        const existingMembership = await tx.membership.findUnique({
          where: {
            orgId_userId: {
              orgId,
              userId: user!.id,
            },
          },
        });

        if (!existingMembership) {
          await tx.membership.create({
            data: {
              id: uuidv7(),
              orgId,
              userId: user!.id,
              role: invitation.role,
            },
          });
        }

        // Mark invitation as accepted.
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: now },
        });
      });
    } else {
      // User does not exist: create user + membership together.
      if (!password || !name) {
        throw new BadRequestException(
          "PASSWORD_AND_NAME_REQUIRED_FOR_NEW_USER",
        );
      }

      const userId = uuidv7();
      const passwordHash = await hash(password, { type: 2 });

      // Create user via platform context.
      await withPlatform("users.write", async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            email: invitation.email,
            passwordHash,
            name,
            status: "ACTIVE", // Invitation acceptance is itself a form of verification.
          },
        });
      });

      // Create membership and mark invitation as accepted inside org context.
      await withTenant(orgId, async (tx) => {
        const membershipId = uuidv7();
        await tx.membership.create({
          data: {
            id: membershipId,
            orgId,
            userId,
            role: invitation.role,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: now },
        });
      });

      user = {
        id: userId,
        email: invitation.email,
        name,
        avatarUrl: null,
        status: "ACTIVE",
        lastLoginAt: null,
      };
    }

    // Auto-login: return the same shape as the login response.
    return await this.authService.buildLoginResponse(user.id, orgId);
  }
}
