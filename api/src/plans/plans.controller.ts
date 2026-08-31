import {
  Controller, Get, Post, Delete, Body, UseGuards, Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlansService } from "./plans.service";
import { IsIn }         from "class-validator";

class UpgradePlanDto {
  @IsIn(["personal", "business"])
  plan: "personal" | "business";
}

@ApiTags("plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get("status")
  @ApiOperation({ summary: "Get current plan, limits and usage" })
  status(@Req() req: any) {
    return this.plans.getPlanStatus(req.user.id);
  }

  @Post("upgrade")
  @ApiOperation({ summary: "Upgrade plan — charges stored card or returns checkout URL" })
  upgrade(@Req() req: any, @Body() dto: UpgradePlanDto) {
    return this.plans.initiateUpgrade(req.user.id, dto.plan);
  }

  @Delete("cancel")
  @ApiOperation({ summary: "Cancel subscription (stays active until expiry date)" })
  cancel(@Req() req: any) {
    return this.plans.cancelPlan(req.user.id);
  }
}
