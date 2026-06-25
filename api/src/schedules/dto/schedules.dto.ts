import {
  IsEnum, IsString, IsNumber, IsOptional, IsDateString,
  IsPositive, Min, IsInt, IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentType, Frequency } from "@prisma/client";

export class CreateScheduleDto {
  @ApiProperty({ enum: PaymentType, example: "Rent" })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({ example: "clxyz123" })
  @IsString()
  beneficiaryId: string;

  @ApiPropertyOptional({ description: "Source bank account ID. Defaults to user's default account." })
  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @ApiProperty({ example: 150000, description: "Amount in kobo-major NGN (e.g. 150000 = ₦150,000)" })
  @IsNumber()
  @IsPositive()
  @Min(100)
  amount: number;

  @ApiProperty({ enum: Frequency, example: "monthly" })
  @IsEnum(Frequency)
  frequency: Frequency;

  @ApiProperty({ example: "2024-08-01", description: "ISO date for first run" })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: "2025-08-01", description: "Optional end date (null = runs forever)" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 12, description: "Max number of runs (null = unlimited)" })
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxOccurrences?: number;

  @ApiPropertyOptional({ example: "Monthly apartment rent" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(100)
  amount?: number;

  @ApiPropertyOptional({ enum: Frequency })
  @IsOptional()
  @IsEnum(Frequency)
  frequency?: Frequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class PauseScheduleDto {
  @ApiPropertyOptional({ example: "Travelling for 2 weeks" })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelScheduleDto {
  @ApiPropertyOptional({ example: "No longer needed" })
  @IsOptional()
  @IsString()
  reason?: string;
}
