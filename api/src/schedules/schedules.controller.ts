import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, Req, Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard }      from "../auth/jwt-auth.guard";
import { SchedulesService }  from "./schedules.service";
import {
  CreateScheduleDto, UpdateScheduleDto,
  PauseScheduleDto, CancelScheduleDto,
} from "./dto/schedules.dto";

@ApiTags("schedules")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("schedules")
export class SchedulesController {
  constructor(private readonly svc: SchedulesService) {}

  @Get()
  @ApiOperation({ summary: "List payment schedules" })
  @ApiQuery({ name: "status", required: false, enum: ["active","paused","cancelled","completed"] })
  findAll(@Req() req: any, @Query("status") status?: string) {
    return this.svc.findAll(req.user.id, status);
  }

  @Get("summary")
  @ApiOperation({ summary: "Dashboard summary — counts + upcoming payments + total spend" })
  getSummary(@Req() req: any) {
    return this.svc.getSummary(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single schedule with transactions" })
  findOne(@Req() req: any, @Param("id") id: string) {
    return this.svc.findOne(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new payment schedule (enqueues BullMQ job)" })
  create(@Req() req: any, @Body() dto: CreateScheduleDto) {
    return this.svc.create(req.user.id, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update amount, frequency, or next-run date" })
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateScheduleDto) {
    return this.svc.update(req.user.id, id, dto);
  }

  @Patch(":id/pause")
  @ApiOperation({ summary: "Pause a schedule (removes queued job)" })
  pause(@Req() req: any, @Param("id") id: string, @Body() dto: PauseScheduleDto) {
    return this.svc.pause(req.user.id, id, dto);
  }

  @Patch(":id/resume")
  @ApiOperation({ summary: "Resume a paused schedule" })
  resume(@Req() req: any, @Param("id") id: string) {
    return this.svc.resume(req.user.id, id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Cancel a schedule permanently" })
  cancel(@Req() req: any, @Param("id") id: string, @Body() dto: CancelScheduleDto) {
    return this.svc.cancel(req.user.id, id, dto);
  }
}
