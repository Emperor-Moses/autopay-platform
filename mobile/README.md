# AutoPay Mobile (Expo / React Native)

Real, runnable Expo app that talks to the AutoPay NestJS API. This replaces
the earlier HTML/web simulation with an actual React Native project you can
run on iOS, Android, or web via Expo.

## Stack

- **Expo SDK 51** + React Native 0.74
- **React Navigation** — native-stack + bottom-tabs
- **TanStack Query** — server state, caching, pagination, mutations
- **Axios** — API client with automatic JWT refresh
- **expo-secure-store** — encrypted token storage (Keychain/Keystore)
- **expo-linear-gradient**, **react-native-svg** — visual design system

## Project Structure

```
autopay-mobile/
├── App.js                     # Root: providers, navigation, font loading
├── app.json                   # Expo config (set your API URL here)
├── src/
│   ├── api/                   # Axios client + endpoint modules
│   │   ├── client.js          # Base instance, auth interceptor, refresh logic
│   │   ├── auth.js            # /auth/* endpoints
│   │   ├── users.js           # /users/* endpoints (profile, bank accounts)
│   │   └── resources.js       # beneficiaries, schedules, transactions, alerts
│   ├── context/
│   │   ├── AuthContext.js     # Session state, login/register/logout
│   │   └── ToastContext.js    # Global toast notifications
│   ├── navigation/
│   │   ├── AuthNavigator.js   # Splash → Login → Signup
│   │   ├── TabNavigator.js    # Home / History / Alerts / Settings
│   │   └── MainNavigator.js   # Wraps tabs + modal screens
│   ├── screens/                # One folder per feature
│   ├── components/             # Button, FormField, Badge, PinModal, etc.
│   ├── theme/                  # Colors, type metadata, spacing
│   └── utils/format.js         # NGN formatting, date helpers
```

## Setup

### 1. Point the app at your API

Edit `app.json`:

```json
"extra": {
  "apiUrl": "https://your-api-domain.com/api/v1"
}
```

For local development with a physical device, use your machine's LAN IP
(not `localhost`) — e.g. `http://192.168.1.50:3000/api/v1` — since the
phone can't resolve your computer's `localhost`. Simulators/emulators can
usually use `localhost`/`10.0.2.2` (Android emulator) directly.

### 2. Install dependencies

```bash
cd autopay-mobile
npm install
```

### 3. (Optional) Add the display font

The design uses **DM Serif Display** for headings/amounts. Without it, the
app still works fine — it falls back to the system font. To enable it:

1. Download `DMSerifDisplay-Regular.ttf` from
   [Google Fonts](https://fonts.google.com/specimen/DM+Serif+Display)
2. Place it at `assets/fonts/DMSerifDisplay-Regular.ttf`
3. Uncomment the `useFonts` block at the top of `App.js`

### 4. Run it

```bash
npx expo start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR
code with the Expo Go app on a physical device.

## Backend Requirements

This app expects the AutoPay NestJS API (in `autopay-backend/`) to be
running and reachable at the `apiUrl` configured above, with:

- `/api/v1/auth/*` — register, login, refresh, logout, PIN
- `/api/v1/users/*` — profile, bank account linking
- `/api/v1/beneficiaries`, `/api/v1/schedules`, `/api/v1/transactions`,
  `/api/v1/alerts`

Seed the database first (`npm run prisma:seed` in the backend) to get the
demo account: `demo@autopay.ng` / `password123`, PIN `0000`.

## Key Flows

- **Auth** — JWT access token (short-lived) + refresh token, stored in
  SecureStore. Axios interceptor auto-refreshes on 401 and retries the
  original request transparently.
- **Create Schedule** — `Schedule` form → `ScheduleConfirm` (review) →
  PIN modal calls `POST /auth/pin/verify`, then `POST /schedules` → `ScheduleSuccess`.
- **Pause / Resume / Cancel** — from `ScheduleDetail`, calls the matching
  `PATCH/DELETE /schedules/:id/*` endpoints and invalidates the schedules
  + summary queries so the dashboard updates instantly.
- **Bank linking** — searches live Paystack bank list, then
  `POST /users/me/bank-accounts` (server verifies via Paystack name-enquiry).
- **Bulk Pay** — builds a batch client-side, submits as one
  `POST /transactions/bulk` call.

## Building for Production

```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

You'll need an Expo account and to configure `eas.json` (not included —
run `eas build:configure` to generate one) plus your bundle
identifiers in `app.json`.

## Notes

- All money values are stored/sent as plain numbers (NGN major units, e.g.
  `150000` = ₦150,000) to match the NestJS DTOs and Prisma `Decimal` fields.
- The PIN-verify call assumes your `/auth/pin/verify` endpoint returns
  something falsy/truthy resolvable to `isValid`. Adjust
  `ScheduleConfirmScreen.js` if your backend's response shape differs.
