import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { verify } from "jsonwebtoken";
import Redis from "ioredis";
import { PUBLIC_KEY } from "../decorators/public.decorator";
import { REDIS_CLIENT } from "../../common/redis.module";

interface JwtPayload {
  sub: string;
  orgId: string;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

/**
 * JwtAuthGuard validates access tokens and attaches user info to the request.
 * Public routes (marked with @Public()) bypass token validation.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid Authorization header");
    }

    const token = authHeader.slice(7);
    let payload: JwtPayload;

    try {
      payload = verify(token, process.env.JWT_SECRET || "dev-only-change-me") as JwtPayload;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    // Check if token is in the denylist (revoked).
    const isDenied = await this.redis.exists(`auth:denylist:${payload.jti}`);
    if (isDenied) {
      throw new UnauthorizedException("Token has been revoked");
    }

    // Attach user info to request for downstream use.
    request.user = {
      id: payload.sub,
      orgId: payload.orgId,
      sid: payload.sid,
      jti: payload.jti,
    };

    return true;
  }
}
