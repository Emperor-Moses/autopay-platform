import {
  Controller, Post, Headers, Body, RawBodyRequest, Req,
  UnauthorizedException, Logger, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from "@nestjs/swagger";
import { Request }        from "express";
import * as crypto        from "crypto";
import { ConfigService }  from "@nestjs/config";
import { PaymentsService } from "../payments.service";

@ApiTags("webhooks")
@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly config:   ConfigService,
  ) {}

  @Post("paystack")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive Paystack webhook events (transfer.success / transfer.failed)" })
  async handlePaystack(
    @Headers("x-paystack-signature") signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const secret = this.config.get<string>("PAYSTACK_SECRET_KEY")!;
    const body   = req.rawBody;

    if (!body) throw new UnauthorizedException("No raw body");

    const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");
    if (hash !== signature) throw new UnauthorizedException("Invalid webhook signature");

    const payload = JSON.parse(body.toString());
    this.logger.log(`Paystack webhook received: ${payload.event}`);

    await this.payments.handlePaystackWebhook(payload.event, payload.data);
    return { received: true };
  }
}
