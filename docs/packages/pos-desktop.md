# POS Desktop (`pos-desktop`)

Electron wrapper that packages the Expo web POS for Windows register PCs.

## Purpose

- Full-screen kiosk-style POS window
- Bundle or spawn local `api-server` for **Windows printer access**
- Serve Expo web build on a fixed port (default **8584**)

## Structure

```
pos-desktop/
├── main.js           # Electron main process
├── preload.js        # Preload bridge (if used)
├── package.json      # electron-builder config
└── release/          # Built installers (output)
```

## Runtime flow

1. Electron `main.js` starts
2. Optionally spawns `api-server` on port 5000
3. Loads Expo web at `http://localhost:8584` (or bundled static)
4. POS UI talks to hosted API for business data; **local API** for print only

Business profile (logo, VAT, store name) is loaded from `GET /api/branches/public` and merged with receipt-heading print settings client-side — see [POS mobile / Expo](pos-mobile-expo.md).

## Dev command

```bash
npm run dev
```

## Build / distribute

```bash
npm run build    # electron-builder → release/
```

Installer targets Windows (NSIS or portable per `package.json` config).

## Register PC requirements

- Windows 10/11
- ESC/POS compatible receipt printer installed
- Network access to production API (or local DB if fully local — uncommon)
- Local API listening on `127.0.0.1:5000` for print endpoints

## Troubleshooting printing

If receipts do not print:

1. Confirm API is running on `127.0.0.1:5000`
2. `GET http://127.0.0.1:5000/api/local/printers` lists printer names
3. Printer name in POS settings must match Windows name exactly
4. Check browser/Electron console — `printerService` may log failures when local print fails

See [Printing](../printing.md).

## Related

- [POS mobile / Expo](pos-mobile-expo.md)
- [API server](api-server.md)
