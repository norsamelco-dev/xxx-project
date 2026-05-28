# Linda Lim POS (Expo)

POS terminal UI shared by **Windows desktop (Electron)** and optional **Android** builds.

## Primary deployment: Windows desktop

Use the Electron wrapper in [`../pos-desktop`](../pos-desktop):

```powershell
cd ../pos-desktop
npm install
npm run dev
```

Production installer: `npm run build:win` in `pos-desktop`.

On Windows desktop, terminal config is stored at `C:\pos\temp\config.json`. Printers use the local API at `http://127.0.0.1:5000/api/local/*`.

## Android (optional / future)

This folder also supports Android Expo Dev Client for tablets/handheld use.

## Prerequisites

- Android emulator running (or a connected Android device)
- The existing API server running locally

## 1) Start the API server

From the repository root:

```powershell
npm run dev --prefix server
```

## 2) Configure API base URL

Copy and edit:

```powershell
cd pos-mobile-expo
cp .env.example .env
```

Primary API (production):

`EXPO_PUBLIC_POS_API_URL=https://pos-api.lindalim.shop`

Local fallback when the primary host is unreachable:

`EXPO_PUBLIC_POS_API_URL_LOCAL=http://127.0.0.1:5000`

On Android, `localhost` in the fallback URL is automatically mapped to `10.0.2.2` for the emulator.

## 3) Start Expo (Metro) on port 8584

```powershell
npm start
```

## 4) Install/update the Expo Dev Client

First time (or after native dependency changes):

```powershell
npx expo prebuild --platform android
npx expo run:android
```

## 5) Run on the emulator

On the Android emulator, forward the Expo packager port:

```powershell
adb reverse tcp:8584 tcp:8584
```

Then open the installed Dev Client app and use the Expo Dev Launcher to load the running bundle.

## Web (browser)

Install dependencies (already in `package.json` after setup):

```powershell
npx expo install react-dom react-native-web
```

Web uses the same `.env` URLs; `localhost` works in the browser for the local fallback.

Start the web dev server:

```powershell
npm run web
```

On web/Electron, config uses `configStore.web.ts` (browser `localStorage` or `C:\pos\temp\config.json` in Electron). Native Android builds use `react-native-fs`.

## Printers

- **Android**: lists paired Bluetooth printers and attached USB devices via the local `linda-printer` module.
- **Web / Windows desktop**: lists printers via `GET http://127.0.0.1:5000/api/local/printers` (local API server required on the register PC).

After changing the native printer module, rebuild the dev client:

```powershell
npx expo prebuild --platform android
npx expo run:android
```

## Notes

- `react-native-fs` is used for reading/writing `config.json` on native platforms, so Android/iOS builds use **Dev Client**, not Expo Go.
