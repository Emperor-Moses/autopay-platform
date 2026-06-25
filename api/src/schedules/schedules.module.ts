import { Module }             from "@nestjs/common";
import { BullModule }         from "@nestjs/bull";
import { SchedulesService }   from "./schedules.service";
import { SchedulesController } from "./schedules.controller";

@Module({
  imports: [
    BullModule.registerQueue({ name: "payments" }),
  ],
  providers:   [SchedulesService],
  controllers: [SchedulesController],
  exports:     [SchedulesService],
})
export class SchedulesModule {}
