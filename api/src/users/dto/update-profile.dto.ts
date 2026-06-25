import { IsString, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: "Amaka Okonkwo" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "+2348012345678" })
  @IsOptional()
  @IsString()
  phone?: string;
}
