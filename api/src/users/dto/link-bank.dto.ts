import { IsString, Length, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LinkBankDto {
  @ApiProperty({ example: "GTBank" })
  @IsString()
  bankName: string;

  @ApiProperty({ example: "058", description: "Paystack bank code" })
  @IsString()
  bankCode: string;

  @ApiProperty({ example: "0123456789" })
  @IsString()
  @Length(10, 10, { message: "Account number must be exactly 10 digits" })
  @Matches(/^\d{10}$/, { message: "Account number must be numeric" })
  accountNumber: string;
}
