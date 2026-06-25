import { IsEmail, IsString, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "amaka@autopay.ng" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "securePass123" })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: "iPhone 15 Pro / iOS 17" })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
