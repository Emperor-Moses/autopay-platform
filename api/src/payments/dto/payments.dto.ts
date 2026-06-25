import { IsString, IsNumber, IsPositive, IsEnum, IsOptional, IsArray, ValidateNested, Min } from "class-validator";
import { Type }  from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentType } from "@prisma/client";

export class BulkPayItemDto {
  @ApiProperty()
  @IsString()
  beneficiaryId: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive()
  @Min(100)
  amount: number;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkPayDto {
  @ApiProperty({ type: [BulkPayItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPayItemDto)
  payments: BulkPayItemDto[];

  @ApiPropertyOptional({ description: "Source bank account ID (uses default if omitted)" })
  @IsOptional()
  @IsString()
  sourceAccountId?: string;
}
