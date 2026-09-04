import { IsEmail } from "class-validator";

export class DiscoverQueryDto {
  @IsEmail()
  email!: string;
}
