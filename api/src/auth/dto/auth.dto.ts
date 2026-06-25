import { IsEmail, IsString, IsOptional, Matches } from "class-validator";
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

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class SetPinDto {
  @ApiProperty({ example: "1234", description: "4-digit numeric PIN" })
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN must be exactly 4 digits" })
  pin: string;

  @ApiProperty({ description: "Current password (required to change PIN)" })
  @IsString()
  currentPassword: string;
}

export class VerifyPinDto {
  @ApiProperty({ example: "1234" })
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN must be exactly 4 digits" })
  pin: string;
}
