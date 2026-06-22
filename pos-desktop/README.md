# Linda LIM POS — Windows Desktop

Primary POS deployment for Windows registers. This package wraps the existing [`pos-mobile-expo`](../pos-mobile-expo) web UI in **Electron**.

## Architecture

- **POS UI:** Expo web export loaded in Electron (`dist/renderer`)
- **Business API:** `EXPO_PUBLIC_POS_API_URL` (hosted Express API)
- **Local printers:** Express API on the same PC at `http://127.0.0.1:5000` (`/api/local/printers`, `/api/local/print`)
- **Terminal config:** `C:\pos\temp\config.json` (via Electron preload bridge)

## Prerequisites

- Windows 10/11
- Node.js 20+
- MySQL-backed API server configured (see [`api-server`](../api-server))

## Development

From repository root:

```powershell
cd pos-desktop
npm install
npm run dev
```

This starts:

1. Local API (`server` on port 5000)
2. Expo web dev server (port 8584)
3. Electron window loading the dev URL

### Dev-only options

| Variable | Effect |
|----------|--------|
| `POS_DESKTOP_DEVTOOLS=1` | Open Chromium DevTools |
| `POS_DESKTOP_WINDOWED=1` | Open in a normal maximized window instead of fullscreen (production) |
| `POS_DESKTOP_FULLSCREEN=0` | Disable fullscreen in production |
| `POS_DESKTOP_FULLSCREEN=1` | Force fullscreen in dev (`npm run dev`) |
| `POS_DESKTOP_KIOSK=1` or `--kiosk` | Fullscreen kiosk window (no exit shortcuts) |
| `--fullscreen` | Force fullscreen |
| `POS_DESKTOP_SKIP_SERVER=1` | Do not wait for / spawn local API |
| `POS_DESKTOP_SPAWN_SERVER=1` | Spawn `server/index.js` via `node` (when not using `npm run dev`) |

## Production build (Windows installer)

1. Configure [`pos-mobile-expo/.env`](../pos-mobile-expo/.env):

```env
EXPO_PUBLIC_POS_API_URL=https://pos-api.lindalim.shop
EXPO_PUBLIC_POS_API_URL_LOCAL=http://127.0.0.1:5000
```

2. Build web bundle + installer:

```powershell
cd pos-desktop
npm install
npm run build:win
```

Installer output: `pos-desktop/release/`

3. On each register PC, run the **local API** for Windows printers (separate terminal or Windows service):

```powershell
cd api-server
npm install
npm run start
```

Set `PORT=5000` in `api-server/.env`.

**Note:** The packaged app serves the Expo web bundle over `http://127.0.0.1` (Expo uses absolute `/_expo/...` paths that do not work with `file://`).

## Keyboard shortcuts (desktop)

On the main POS screen:

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Product search |
| Ctrl+Q | Custom quantity |
| Ctrl+D | Discount |
| Ctrl+Enter | Checkout |

## Single instance

Only one POS window is allowed per machine. Launching again focuses the existing window.

## Android / mobile

Android code remains in [`pos-mobile-expo`](../pos-mobile-expo) for future use. Windows Electron is the supported production terminal.

## Code signing (optional)

For fewer SmartScreen warnings, sign the NSIS installer with a code-signing certificate and configure `win.signedHashAlgorithms` in `electron-builder` when ready.
