# AutoPay API — NestJS Backend

This is the backend for the AutoPay mobile app: authentication, bank
account linking, beneficiary management, recurring payment scheduling,
and Paystack webhook handling, backed by PostgreSQL (via Prisma) and
BullMQ (via Redis) for the scheduling engine.

This package was reconstructed from an uploaded file bundle into a
correct NestJS module layout. Every relative import in all 39 TypeScript
files has been verified programmatically to resolve to a real file on
disk — there are no broken imports.

## Project structure

```
api/
├── src/
│   ├── main.ts                  Bootstrap: helmet, CORS, ValidationPipe, Swagger
│   ├── app.module.ts            Root module — wires up Config, Throttler, Bull, all features
│   ├── common/
│   │   └── prisma/
│   │       ├── prisma.module.ts
│   │       └── prisma.service.ts   Global PrismaClient wrapper
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts      /auth/register, /login, /refresh, /pin
│   │   ├── auth.service.ts         bcrypt hashing, JWT issuing, PIN verification
│   │   ├── jwt.strategy.ts         Passport JWT strategy
│   │   ├── jwt-auth.guard.ts       Route guard
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       ├── auth.dto.ts         (consolidated — used by the controller)
│   │       ├── login.dto.ts        (individual — used by the service)
│   │       ├── set-pin.dto.ts
│   │       └── verify-pin.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts     /users/me, bank account endpoints
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── update-profile.dto.ts
│   │       ├── update-settings.dto.ts
│   │       ├── change-password.dto.ts
│   │       └── link-bank.dto.ts
│   ├── beneficiaries/
│   │   ├── beneficiaries.module.ts
│   │   ├── beneficiaries.controller.ts
│   │   ├── beneficiaries.service.ts   Calls Paystack to resolve/verify account names
│   │   └── dto/beneficiaries.dto.ts
│   ├── schedules/
│   │   ├── schedules.module.ts
│   │   ├── schedules.controller.ts
│   │   ├── schedules.service.ts       Create/pause/resume/cancel recurring schedules
│   │   └── dto/schedules.dto.ts
│   ├── payments/
│   │   ├── payments.module.ts
│   │   ├── payments.controller.ts     /transactions, bulk pay
│   │   ├── payments.service.ts        Initiates Paystack charges, records transactions
│   │   ├── dto/payments.dto.ts
│   │   └── webhooks/
│   │       └── webhook.controller.ts  Verifies Paystack signature, processes events
│   ├── jobs/
│   │   ├── jobs.module.ts
│   │   └── payment.processor.ts       BullMQ worker — executes due schedules
│   └── alerts/
│       ├── alerts.module.ts
│       ├── alerts.controller.ts
│       └── alerts.service.ts
├── prisma/
│   ├── schema.prisma             Full data model (User, BankAccount, Beneficiary,
│   │                              Schedule, Transaction, Alert)
│   └── seed.ts                   Demo user + sample schedule for local testing
├── .env.example
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── package.json
└── .gitignore
```

## 1. Install dependencies

```bash
cd api
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in:
- `DATABASE_URL` — your PostgreSQL connection string
- `JWT_SECRET` — generate with `openssl rand -hex 32`
- `REDIS_HOST` / `REDIS_PORT` — for BullMQ (run Redis locally with
  `docker run -p 6379:6379 redis` if you don't have it installed)
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` — from your Paystack
  dashboard (use test keys while developing)

## 3. Set up the database

```bash
npx prisma generate          # generates the Prisma client
npx prisma migrate dev       # creates tables from schema.prisma
npx prisma db seed           # optional — adds a demo user (demo@autopay.ng / password123, PIN 0000)
```

## 4. Run the API

```bash
npm run start:dev
```

The API starts on `http://localhost:3000`. Swagger docs are available at
`http://localhost:3000/api` (check `main.ts` for the exact mount path).

## 5. Connect the mobile app

In the mobile project's `app.json`, set `expo.extra.apiUrl` to this API's
address. If testing on a physical device or emulator, use your machine's
LAN IP rather than `localhost`:

```json
"extra": { "apiUrl": "http://192.168.1.50:3000/api/v1" }
```

## How the payment scheduling engine works

1. `POST /schedules` creates a row in `payment_schedules` with a
   `nextRunAt` timestamp.
2. A BullMQ repeatable/delayed job is registered (`jobs/payment.processor.ts`)
   to fire at that timestamp.
3. When the job runs, `PaymentProcessor` calls `PaymentsService` to
   initiate a Paystack charge against the linked bank account's stored
   authorization code.
4. Paystack sends a webhook to `payments/webhooks/webhook.controller.ts`,
   which verifies the HMAC signature, updates the transaction status, and
   triggers an alert via `AlertsService`.
5. On success, the schedule's `nextRunAt` is advanced according to its
   `frequency`; on failure, a retry is queued.

## Notes on what was fixed during packaging

The uploaded bundle had all 35 files flattened into a single folder with
no subfolders, one exact duplicate (`users.service (1).ts`, discarded),
and several DTO files that needed splitting. Specifically:
`auth.controller.ts` imports a consolidated `./dto/auth.dto` containing
all four auth DTOs, while `auth.service.ts` imports three of those same
DTOs as individual files (`login.dto.ts`, `set-pin.dto.ts`,
`verify-pin.dto.ts`). Both import styles needed to resolve, so both the
consolidated file and the three individual files now exist side by side
with matching class definitions. The same split was needed for
`users.dto.ts` into four individual files
(`update-profile.dto.ts`, `update-settings.dto.ts`,
`change-password.dto.ts`, `link-bank.dto.ts`).

`payment.processor.ts` was moved from a flat location into
`src/jobs/payment.processor.ts` — its own import of
`../payments/payments.service` only resolves correctly from inside the
`jobs/` folder, and `jobs.module.ts` already expected it there.

Four standard NestJS project files were missing from the upload and have
been added: `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, and
`.gitignore`. Without these, `nest build` / `nest start` cannot run.
