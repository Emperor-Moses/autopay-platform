import { IsString, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SetPinDto {
  @ApiProperty({ example: "1234", description: "4-digit numeric PIN" })
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN must be exactly 4 digits" })
  pin: string;

  @ApiProperty({ description: "Current password (required to change PIN)" })
  @IsString()
  currentPassword: string;
}
