import { Module }          from "@nestjs/common";
import { BullModule }      from "@nestjs/bull";
import { PaymentProcessor } from "./payment.processor";
import { PaymentsModule }   from "../payments/payments.module";

@Module({
  imports: [
    BullModule.registerQueue({ name: "payments" }),
    PaymentsModule,
  ],
  providers: [PaymentProcessor],
})
export class JobsModule {}
