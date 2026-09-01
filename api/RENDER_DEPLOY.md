# AutoPay API — Render deployment

The repository contains a NestJS API under `api/` and an Expo mobile app under `mobile/`.

## Render Web Service

Use the included `render.yaml` or configure manually:

- Runtime: Docker
- Root directory: `api`
- Dockerfile: `api/Dockerfile`
- Health check: `/api/v1/health`
- Auto-deploy: On Commit

The container builds Prisma Client and the NestJS application, then runs `prisma migrate deploy` before starting the API.

## Required environment variables

Set these in Render. Do not commit real secrets.

```text
DATABASE_URL=<Neon pooled PostgreSQL URL>
DIRECT_URL=<Neon direct PostgreSQL URL>
JWT_SECRET=<long random secret>
REDIS_URL=rediss://:<password>@<upstash-host>:6379
PAYSTACK_SECRET_KEY=<Paystack secret key>
PAYSTACK_PUBLIC_KEY=<Paystack public key>
PAYSTACK_CALLBACK_URL=https://auto-pay.com.ng/account-linked
DIRECT_DEBIT_CALLBACK_URL=https://auto-pay.com.ng/
FRONTEND_URLS=https://auto-pay.com.ng,https://www.auto-pay.com.ng
NODE_ENV=production
```

Render supplies `PORT` automatically; the application listens on `0.0.0.0`.

## Important

- Never upload `.env` to GitHub.
- Rotate any credentials that were previously committed to the repository.
- If the Neon database already contains tables created outside Prisma migrations, do not run the initial migration blindly. Baseline/adopt the existing schema first.
