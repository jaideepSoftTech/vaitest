import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { InvitationsService } from "./invitations.service";
import { AcceptInvitationDto } from "../auth/dto/accept-invitation.dto";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";

/**
 * InvitationsController handles invitation acceptance.
 */
@Controller("invitations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  /**
   * POST /api/v1/invitations/accept
   * Accept an invitation token and auto-login.
   */
  @Post("accept")
  @Public()
  @HttpCode(200)
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Res() res: Response,
  ): Promise<void> {
    const { result, refreshToken } =
      await this.invitationsService.acceptInvitation(
        dto.token,
        dto.password,
        dto.name,
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
}
