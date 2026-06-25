# AutoPay Mobile — Build Guide

This is an Expo / React Native app, reconstructed from the uploaded file
bundle into a proper Expo project layout. Every relative import has been
verified programmatically to resolve correctly.

## Project structure

```
mobile/
├── App.js                  Root component — auth gate, providers, fonts
├── app.json                Expo config (app name, bundle ID, API URL)
├── eas.json                EAS Build profiles (debug / preview APK / production AAB)
├── babel.config.js
├── package.json
└── src/
    ├── api/                Axios client + per-resource API calls
    │   ├── client.js           axios instance, token refresh interceptor
    │   ├── auth.js              /auth/* endpoints
    │   ├── users.js             /users/me, bank account linking
    │   └── resources.js         beneficiaries, schedules, transactions, banks
    ├── context/
    │   ├── AuthContext.js   Session boot, login/logout, current user
    │   └── ToastContext.js  Global toast notifications
    ├── navigation/
    │   ├── AuthNavigator.js  Splash → Login → Signup stack
    │   ├── MainNavigator.js  Wraps TabNavigator + modal-style screens
    │   └── TabNavigator.js   Bottom tabs: Dashboard / History / Alerts / Settings
    ├── screens/
    │   ├── auth/             SplashScreen, LoginScreen, SignupScreen
    │   ├── dashboard/         DashboardScreen (balance, quick actions, upcoming)
    │   ├── schedule/          Create → Confirm → Success → Detail flow
    │   ├── beneficiaries/     Recipient management
    │   ├── bank/              Bank account linking (Paystack/Mono)
    │   ├── bulk/              Bulk payment scheduling
    │   ├── history/           Transaction history
    │   ├── alerts/            Notifications/alerts feed
    │   ├── settings/          Profile, notification prefs, logout
    │   └── analytics/         Spend breakdown
    ├── components/         Shared UI: Button, Badge, FormField, PinModal,
    │                       ScheduleCard, ScreenHeader, EmptyState
    ├── theme/index.js      COLORS, RADIUS, TYPE_META, FREQ_LABEL, bank helpers
    └── utils/format.js     NGN currency formatter, date helpers
```

## 1. Install dependencies

```bash
cd mobile
npm install
```

## 2. Point the app at your API

Edit `app.json` → `expo.extra.apiUrl`:

```json
"extra": {
  "apiUrl": "https://api.auto-pay.com.ng/api/v1"
}
```

For local development against the NestJS API running on your machine,
use your computer's LAN IP — not `localhost`, since the emulator/phone
cannot reach your machine's localhost:

```json
"extra": {
  "apiUrl": "http://192.168.1.50:3000/api/v1"
}
```

## 3. Run in development (Expo Go / simulator)

```bash
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) or press `a` for the Android
emulator.

## 4. Build a real installable APK

This requires a free Expo account (eas.io) and the EAS CLI.

```bash
npm install -g eas-cli
eas login
eas build:configure        # links this project to your Expo account
eas build -p android --profile preview
```

The `preview` profile (already configured in `eas.json`) outputs a direct
`.apk` file you can install on any Android device — no Play Store review
needed for this build type.

When the build finishes, EAS gives you a download link straight to the
`.apk` file. Download it, transfer it to your device (or scan the QR code
shown in your terminal), and tap to install. You may need to allow
"install from unknown sources" once.

For a Play Store-ready release, use:

```bash
eas build -p android --profile production
```

This produces an `.aab` (Android App Bundle) instead, which is what the
Play Console requires for store submissions.

## 5. Required backend

This app expects the AutoPay NestJS API (the `api/` project in this same
delivery) running and reachable at the URL set in `app.json`. Key
endpoints it calls:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- `GET /users/me`, bank account linking endpoints
- `GET/POST /beneficiaries`
- `GET/POST /schedules`, pause/resume/cancel
- `GET /transactions`, `POST /transactions/bulk`

All endpoints require a Bearer token (handled automatically by the axios
interceptor in `src/api/client.js`) except `/auth/register` and
`/auth/login`.

## Notes on what was fixed during packaging

The uploaded file bundle had every file flattened into a single folder
with no subfolders, plus a couple of duplicate-named files (e.g.
`App (1).js`, `package (1).json`). Each file's own `import` statements
were used as the source of truth to reconstruct the correct nested
folder structure — for example, `BankScreen.js` imports `../../theme`,
which only resolves correctly if the file lives two levels below `src/`,
i.e. at `src/screens/bank/BankScreen.js`.

Every one of the 33 source files in this package has been verified
programmatically: every relative import resolves to a real file on
disk. There are no broken imports.
