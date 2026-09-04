import { IsString, IsOptional, Length } from "class-validator";

export class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  @Length(8, 256)
  password?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;
}
