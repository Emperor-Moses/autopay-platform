import {
  Controller, Get, Post, Param, Body, UseGuards, Req, Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard }   from "../auth/jwt-auth.guard";
import { PaymentsService } from "./payments.service";
import { BulkPayDto }     from "./dto/payments.dto";

@ApiTags("transactions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("transactions")
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: "List transaction history with pagination" })
  @ApiQuery({ name: "limit",  required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  list(
    @Req() req: any,
    @Query("limit")  limit  = 20,
    @Query("offset") offset = 0,
    @Query("status") status?: string,
  ) {
    return this.svc.getTransactions(req.user.id, +limit, +offset, status);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single transaction" })
  findOne(@Req() req: any, @Param("id") id: string) {
    return this.svc.getTransaction(req.user.id, id);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Create a bulk payment batch (queues multiple transfers)" })
  bulk(@Req() req: any, @Body() dto: BulkPayDto) {
    return this.svc.createBulkPayment(req.user.id, dto);
  }
}
