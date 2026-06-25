import { Module }           from "@nestjs/common";
import { BullModule }       from "@nestjs/bull";
import { PaymentsService }  from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { WebhookController }  from "./webhooks/webhook.controller";
import { SchedulesModule }    from "../schedules/schedules.module";

@Module({
  imports: [
    BullModule.registerQueue({ name: "payments" }),
    SchedulesModule,
  ],
  providers:   [PaymentsService],
  controllers: [PaymentsController, WebhookController],
  exports:     [PaymentsService],
})
export class PaymentsModule {}
