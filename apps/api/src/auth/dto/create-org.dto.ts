import { IsString, IsOptional, Length } from "class-validator";

export class CreateOrgDto {
  @IsString()
  @Length(1, 255)
  orgName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  orgSlug?: string;

  @IsString()
  dataRegion!: "US" | "EU"; // DataRegion enum values
}
