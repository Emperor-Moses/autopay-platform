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
  app.enableCors({
    origin:      process.env.NODE_ENV === "production"
      ? ["https://autopay.ng", "https://app.autopay.ng"]
      : "*",
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
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀  AutoPay API running on http://localhost:${port}/api/v1`);
  logger.log(`📖  Swagger docs at  http://localhost:${port}/docs`);
}

bootstrap();
