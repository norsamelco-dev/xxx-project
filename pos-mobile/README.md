# Linda Lim POS Mobile

React Native POS terminal for Windows and Android tablets. Connects to the existing Express API in `../server`.

## Setup

1. Start the API:

```powershell
npm run dev --prefix server
```

2. Install mobile dependencies:

```powershell
cd pos-mobile
npm install
```

3. Configure API URL (optional):

```env
POS_API_URL=http://YOUR_SERVER_IP:5000
```

4. Run Metro (port **8584**):

```powershell
npm start
```

5. In a **second terminal**, run on Android (emulator must show `device`, not `offline`):

```powershell
npm run android
```

If Metro says a server is already on **8081**, stop it first:

```powershell
netstat -ano | findstr :8081
taskkill /PID <pid> /F
```

**Emulator offline?** In Android Studio: Device Manager → cold boot the AVD, or run `adb kill-server` then `adb start-server`.

**API from emulator:** use `POS_API_URL=http://10.0.2.2:5000` (host machine port 5000).

## Local config

- Windows: `C:\pos\temp\config.json`
- Android: app document directory `/pos/config.json`

## Flow

Bootstrap → Machine Registration → Printer Selection → Login → Main POS → Checkout / X Report / Z Report / Utilities

## API

Uses `/api/pos/*` endpoints and mobile Bearer token from `POST /api/auth/login` with `{ mobile: true }`.
