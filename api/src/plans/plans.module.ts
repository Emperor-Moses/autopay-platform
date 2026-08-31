import { Module }          from "@nestjs/common";
import { PlansController } from "./plans.controller";
import { PlansService }    from "./plans.service";
import { PrismaModule }    from "../common/prisma/prisma.module";

@Module({
  imports:     [PrismaModule],
  controllers: [PlansController],
  providers:   [PlansService],
  exports:     [PlansService],   // export so PaymentsService / SchedulesService can import it
})
export class PlansModule {}
