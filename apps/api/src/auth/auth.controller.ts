import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Query,
  BadRequestException,
  HttpCode,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService, UserInfo, OrgInfo, DiscoverResult } from "./auth.service";
import { SignupDto } from "./dto/signup.dto";
import { LoginDto } from "./dto/login.dto";
import { VerifyEmailDto, ResendVerificationDto } from "./dto/verify-email.dto";
import { DiscoverQueryDto } from "./dto/discover.dto";
import { CreateOrgDto } from "./dto/create-org.dto";
import { Public } from "./decorators/public.decorator";
import { RequirePermissions } from "./decorators/require-permissions.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionGuard } from "./guards/permission.guard";
import { Inject } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../common/redis.module";

/**
 * AuthController handles all authentication endpoints.
 * All routes are marked either @Public() or @RequirePermissions(...).
 */
@Controller("auth")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  /**
   * POST /api/v1/auth/signup
   * Requires Idempotency-Key header. Always returns 202.
   */
  @Post("signup")
  @Public()
  @HttpCode(202)
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
  ): Promise<{ emailVerificationRequired: boolean }> {
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new BadRequestException("Idempotency-Key header is required");
    }

    return this.authService.signup(
      dto.email,
      dto.password,
      dto.name,
      dto.orgName,
      dto.orgSlug,
      dto.dataRegion,
      idempotencyKey,
    );
  }

  /**
   * POST /api/v1/auth/login
   */
  @Post("login")
  @Public()
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ipAddress = (req.ip || "0.0.0.0").split(":").pop() || "0.0.0.0";

    const { result, refreshToken } = await this.authService.login(
      dto.email,
      dto.password,
      ipAddress,
    );

    // Set refresh token cookie (httpOnly, Secure, SameSite=Strict, Path=/api/v1/auth).
    // Note: In dev, Secure should be false; in prod, it should be true.
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 2592000000, // 30 days in ms
    });

    res.json(result);
  }

  /**
   * POST /api/v1/auth/refresh
   */
  @Post("refresh")
  @Public()
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      throw new BadRequestException("refresh_token cookie missing");
    }

    const { accessToken, newRefreshToken } =
      await this.authService.refresh(refreshToken);

    // Set new refresh token cookie.
    res.cookie("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 2592000000,
    });

    res.json({ accessToken });
  }

  /**
   * POST /api/v1/auth/logout
   */
  @Post("logout")
  @RequirePermissions() // Authenticated only, no specific perms.
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies.refresh_token;
    const jti = req.user?.jti;

    await this.authService.logout(refreshToken, jti);

    // Clear refresh token cookie.
    res.clearCookie("refresh_token", {
      path: "/api/v1/auth",
    });

    res.status(204).send();
  }

  /**
   * GET /api/v1/auth/me
   */
  @Get("me")
  @RequirePermissions() // Authenticated only.
  async getMe(
    @Req() req: Request,
  ): Promise<{
    user: UserInfo;
    activeOrgId: string;
    orgs: OrgInfo[];
  }> {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
    if (!userId || !orgId) {
      throw new BadRequestException("User context missing");
    }

    // Fetch full user + orgs.
    const { result } = await this.authService.buildLoginResponse(userId);

    return {
      user: result.user,
      activeOrgId: orgId,
      orgs: result.orgs,
    };
  }

  /**
   * GET /api/v1/auth/discover?email=...
   * Rate limited: 20 requests per minute per IP.
   */
  @Get("discover")
  @Public()
  async discover(
    @Query() query: DiscoverQueryDto,
    @Req() req: Request,
  ): Promise<DiscoverResult> {
    const ipAddress = (req.ip || "0.0.0.0").split(":").pop() || "0.0.0.0";
    const rateLimitKey = `rl:discover:${ipAddress}`;

    const attempts = await this.redis.incr(rateLimitKey);
    if (attempts === 1) {
      await this.redis.expire(rateLimitKey, 60); // 1 minute window
    }

    if (attempts > 20) {
      throw new BadRequestException("Rate limit exceeded");
    }

    return this.authService.discover(query.email);
  }

  /**
   * POST /api/v1/auth/verify-email
   */
  @Post("verify-email")
  @Public()
  @HttpCode(200)
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res() res: Response,
  ): Promise<void> {
    const { result, refreshToken } = await this.authService.verifyEmail(
      dto.token,
    );

    // Set refresh token cookie.
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 2592000000,
    });

    res.json(result);
  }

  /**
   * POST /api/v1/auth/verify-email/resend
   */
  @Post("verify-email/resend")
  @Public()
  @HttpCode(200)
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ ok: boolean }> {
    return this.authService.resendVerificationEmail(dto.email);
  }

  /**
   * POST /api/v1/auth/orgs
   * Create a new org for the authenticated user.
   */
  @Post("orgs")
  @RequirePermissions() // Authenticated only.
  @HttpCode(201)
  async createOrg(
    @Body() dto: CreateOrgDto,
    @Req() req: Request,
  ): Promise<OrgInfo> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User context missing");
    }

    return this.authService.createOrg(
      userId,
      dto.orgName,
      dto.orgSlug,
      dto.dataRegion,
    );
  }
}
