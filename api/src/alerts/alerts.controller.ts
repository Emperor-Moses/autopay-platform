import {
  Controller, Get, Patch, Delete, Param, Query,
  UseGuards, Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard }  from "../auth/jwt-auth.guard";
import { AlertsService } from "./alerts.service";

@ApiTags("alerts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("alerts")
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  @Get()
  @ApiOperation({ summary: "List alerts (optionally only unread)" })
  @ApiQuery({ name: "unread", required: false, type: Boolean })
  findAll(@Req() req: any, @Query("unread") unread?: string) {
    return this.svc.findAll(req.user.id, unread === "true");
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Get unread alert count (for badge)" })
  unreadCount(@Req() req: any) {
    return this.svc.getUnreadCount(req.user.id);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a single alert as read" })
  markRead(@Req() req: any, @Param("id") id: string) {
    return this.svc.markRead(req.user.id, id);
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark all alerts as read" })
  markAllRead(@Req() req: any) {
    return this.svc.markAllRead(req.user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an alert" })
  delete(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteAlert(req.user.id, id);
  }
}
