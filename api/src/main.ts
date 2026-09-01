import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app    = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  // ── Security ───────────────────────────────────────────────────────────────
  app.use(helmet());
  const configuredOrigins = (process.env.FRONTEND_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  app.enableCors({
    origin: process.env.NODE_ENV === "production"
      ? configuredOrigins
      : true,
    credentials: true,
  });

  // ── Global pipes ──────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:        true,
      forbidNonWhitelisted: true,
      transform:        true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── API prefix ────────────────────────────────────────────────────────────
  app.setGlobalPrefix("api/v1");

  // ── Swagger ───────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle("AutoPay API")
    .setDescription(
      "Scheduled payment automation platform for Nigerian businesses & individuals. " +
      "Powered by Paystack & BullMQ.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .addTag("auth",          "Authentication & sessions")
    .addTag("users",         "User profile & settings")
    .addTag("bank-accounts", "Linked bank accounts")
    .addTag("beneficiaries", "Payment recipients")
    .addTag("schedules",     "Payment schedules")
    .addTag("transactions",  "Transaction history")
    .addTag("alerts",        "Notifications & alerts")
    .addTag("bulk",          "Bulk payment batches")
    .addTag("webhooks",      "Paystack webhook endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  logger.log(`🚀  AutoPay API running on http://localhost:${port}/api/v1`);
  logger.log(`📖  Swagger docs at  http://localhost:${port}/docs`);
}

bootstrap();
