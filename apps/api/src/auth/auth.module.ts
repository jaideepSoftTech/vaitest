import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { RedisModule } from "../common/redis.module";
import { EntitlementService } from "../entitlements/entitlements.service";
import { InvitationsService } from "../invitations/invitations.service";
import { InvitationsController } from "../invitations/invitations.controller";
import { IdentityService } from "../identity/identity.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-only-change-me",
      signOptions: { expiresIn: "15m" },
    }),
    RedisModule,
  ],
  providers: [AuthService, EntitlementService, InvitationsService, IdentityService],
  controllers: [AuthController, InvitationsController],
  exports: [AuthService, EntitlementService, IdentityService],
})
export class AuthModule {}
