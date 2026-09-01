import { Controller, Get } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { PrismaService } from "./common/prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiExcludeEndpoint()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", service: "autopay-api", timestamp: new Date().toISOString() };
  }
}
