import { IsString, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyPinDto {
  @ApiProperty({ example: "1234" })
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN must be exactly 4 digits" })
  pin: string;
}
