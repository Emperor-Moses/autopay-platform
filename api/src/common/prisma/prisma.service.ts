import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("✅ Prisma connected");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Soft-delete helper — adds deletedAt instead of physically removing a row */
  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where:  { id },
      data:   { deletedAt: new Date() },
    });
  }
}
