import { Module } from "@nestjs/common";
import { PlansModule } from "./plans/plans.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bull";

import { PrismaModule }        from "./common/prisma/prisma.module";
import { AuthModule }          from "./auth/auth.module";
import { UsersModule }         from "./users/users.module";
import { BeneficiariesModule } from "./beneficiaries/beneficiaries.module";
import { SchedulesModule }     from "./schedules/schedules.module";
import { PaymentsModule }      from "./payments/payments.module";
import { AlertsModule }        from "./alerts/alerts.module";
import { JobsModule }          from "./jobs/jobs.module";
import { HealthController }    from "./health.controller";

@Module({
  imports: [
    // ── Config ─────────────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),

    // ── Rate limiting ───────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject:   [ConfigService],
      useFactory: (cfg: ConfigService) => ([{
        ttl:   cfg.get("THROTTLE_TTL",   60000),
        limit: cfg.get("THROTTLE_LIMIT", 100),
      }]),
    }),

    // ── BullMQ / Redis ──────────────────────────────────────────────────────
    BullModule.forRootAsync({
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const redisUrl = cfg.get<string>("REDIS_URL");
        let redis: Record<string, any>;

        if (redisUrl) {
          const url = new URL(redisUrl);
          redis = {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password ? decodeURIComponent(url.password) : undefined,
            tls: url.protocol === "rediss:" ? {} : undefined,
          };
        } else {
          const host = cfg.get<string>("REDIS_HOST", "localhost");
          redis = {
            host,
            port: cfg.get<number>("REDIS_PORT", 6379),
            password: cfg.get<string>("REDIS_PASSWORD") || undefined,
            tls: host !== "localhost" ? {} : undefined,
          };
        }

        return {
          redis,
          defaultJobOptions: {
          attempts:    3,
          backoff:     { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail:     { count: 50 },
        },
      };
      },
    }),

    // ── Feature modules ─────────────────────────────────────────────────────
    PrismaModule,
    AuthModule,
    UsersModule,
    BeneficiariesModule,
    SchedulesModule,
    PaymentsModule,
    AlertsModule,
    JobsModule,
    PlansModule
  ],
  controllers: [HealthController],
})
export class AppModule {}
