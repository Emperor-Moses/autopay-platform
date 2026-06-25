import { IsEmail, IsString, MinLength, IsOptional, Matches } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "Amaka Okonkwo" })
  @IsString()
  name: string;

  @ApiProperty({ example: "amaka@autopay.ng" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "securePass123", minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: "+2348012345678" })
  @IsOptional()
  @IsString()
  phone?: string;
}
