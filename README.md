# AutoPay Platform

Full-stack recurring payment automation platform for Nigeria.

## What's in this package

```
AutoPay-Platform/
├── mobile/    React Native (Expo) app — see mobile/BUILD_GUIDE.md
└── api/       NestJS backend (Prisma + PostgreSQL + BullMQ) — see api/BUILD_GUIDE.md
```

## Quick start

1. **Backend first**: follow `api/BUILD_GUIDE.md` to get the NestJS API
   running locally (PostgreSQL + Redis + Paystack test keys).
2. **Then mobile**: follow `mobile/BUILD_GUIDE.md` to install dependencies,
   point the app at your API URL, and either run it in Expo Go for
   development or build a real installable `.apk` with EAS Build.

## What was done to make this buildable

Both the mobile app and the API were delivered as flat file dumps with
no folder structure — every file sitting in one directory regardless of
which module or screen it belonged to, plus a few duplicate files from
re-exports. Every file's own `import`/`require` statements were used as
the source of truth to reconstruct the correct project layout: if a file
said `from "../../theme"`, it was placed exactly two directories below
wherever `theme/` lives, no matter where it happened to sit in the
original upload.

After reconstruction, every relative import across all 75 source files
(35 mobile, 40 API) was verified programmatically — a script walked every
file, resolved every relative import against the actual files on disk,
and confirmed there are zero broken imports in either project.

Additionally, a small number of files referenced by imports but not
present in the upload were identified and added:
- **Mobile**: `eas.json` (required for building an APK with EAS Build)
- **API**: `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`,
  `.gitignore` (required for `nest build`/`nest start` to run at all),
  and four individual DTO files that some service files imported
  separately while their matching controllers imported a consolidated
  version of the same classes.

See `mobile/BUILD_GUIDE.md` and `api/BUILD_GUIDE.md` for the full detail
on what was reorganised in each project.
