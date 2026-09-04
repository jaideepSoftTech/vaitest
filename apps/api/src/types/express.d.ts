// apps/api/src/types/express.d.ts
//
// Augments Express's Request with the `user` property JwtAuthGuard attaches
// after validating an access token (see auth/guards/jwt-auth.guard.ts). Every
// route that isn't `@Public()` runs behind that guard, so `req.user` is
// present by the time a controller handler runs — but TypeScript has no way
// to know that from the base Express types, hence the `?`.

export interface RequestUser {
  id: string;
  orgId: string;
  sid: string;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
