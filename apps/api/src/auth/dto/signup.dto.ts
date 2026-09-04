import { IsEmail, IsString, Length } from "class-validator";

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 256)
  password!: string;

  @IsString()
  @Length(1, 255)
  name!: string;

  @IsString()
  @Length(1, 255)
  orgName!: string;

  @IsString()
  orgSlug?: string;

  @IsString()
  dataRegion!: "US" | "EU"; // DataRegion enum values
}
