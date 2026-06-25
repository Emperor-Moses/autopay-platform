import { IsBoolean, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  balance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmations?: boolean;
}
