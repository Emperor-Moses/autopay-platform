import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard }               from "../auth/jwt-auth.guard";
import { BeneficiariesService }       from "./beneficiaries.service";
import { CreateBeneficiaryDto, UpdateBeneficiaryDto } from "./dto/beneficiaries.dto";

@ApiTags("beneficiaries")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("beneficiaries")
export class BeneficiariesController {
  constructor(private readonly svc: BeneficiariesService) {}

  @Get()
  @ApiOperation({ summary: "List all recipients" })
  findAll(@Req() req: any) {
    return this.svc.findAll(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single recipient with their schedules & recent txns" })
  findOne(@Req() req: any, @Param("id") id: string) {
    return this.svc.findOne(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: "Add a new recipient (verifies via Paystack name-enquiry)" })
  create(@Req() req: any, @Body() dto: CreateBeneficiaryDto) {
    return this.svc.create(req.user.id, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update recipient metadata (name, nickname, note)" })
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateBeneficiaryDto) {
    return this.svc.update(req.user.id, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove a recipient (only if no active schedules)" })
  remove(@Req() req: any, @Param("id") id: string) {
    return this.svc.remove(req.user.id, id);
  }
}
