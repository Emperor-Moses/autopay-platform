import { IsString, IsOptional, Length, Matches, IsEmail } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBeneficiaryDto {
  @ApiProperty({ example: "Chidi Landlord" })
  @IsString()
  name: string;

  @ApiProperty({ example: "Access Bank" })
  @IsString()
  bank: string;

  @ApiProperty({ example: "044", description: "Paystack bank code" })
  @IsString()
  bankCode: string;

  @ApiProperty({ example: "0987654321" })
  @IsString()
  @Length(10, 10, { message: "Account number must be exactly 10 digits" })
  @Matches(/^\d{10}$/, { message: "Account number must be numeric" })
  accountNumber: string;

  @ApiPropertyOptional({ example: "Chidi Eze (Landlord)" })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateBeneficiaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
