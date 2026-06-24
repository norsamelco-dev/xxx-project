# POS Mobile / Expo (`pos-mobile-expo`)

Shared POS terminal UI — runs in browser, Electron webview, or Android.

## Structure

```
pos-mobile-expo/
├── App.tsx / app entry
├── src/
│   ├── screens/           # MainPosScreen, login, setup
│   ├── services/          # API, printer
│   │   └── printer/
│   │       ├── printerService.ts
│   │       └── layouts/   # Receipt, X/Z layouts
│   ├── components/        # Modals, cart, etc.
│   └── types/
└── app.json
```

## Bootstrap flow

1. **Machine setup** — register or select terminal (serial, machine name)
2. **Printer setup** — select Windows printer (desktop) or skip (mobile)
3. **Login** — cashier credentials; API validates terminal + branch
4. **Open series** — starting balance if required
5. **Main POS** — scan/search, cart, checkout, reports

## Main screen (`MainPosScreen.tsx`)

- Product search and barcode entry
- Cart with qty adjust and remove
- Checkout → receipt print
- X report, Z report (passes `activeSeriesNo`)
- Cash count sheet modal
- Void transactions (series scope)

## API client

- Base URL from `EXPO_PUBLIC_POS_API_URL` with local fallback
- Bearer token on authenticated routes
- POS routes under `/api/pos/*`
- **Business profile** (name, logo, VAT, TIN) from `GET /api/branches/public?branch_code=...` (reads `branches` table)
- **Developer / receipt print settings** from `GET /api/receipt-heading/public`
- POS merges both via `getPosReceiptContextPublic()` in `services/api/posApi.ts` for receipts, login branding, and VAT mode
- API connectivity test pings `/api/branches/public`

## Reports (X/Z)

Client calls:

- `getXReport(machineName, salesSeriesNo)`
- `runZReport(machineName, salesSeriesNo, ...)`

Server validates series is **open**, owned by user, on machine; aggregates `sales_a` for that series only.

## Printing

See [Printing](../printing.md).

- Layout builders in `layouts/receiptLayouts.ts`, `reportLayouts.ts`
- `printerService.ts` posts raw bytes to local API on web/desktop

## Dev commands

```bash
npm run web        # Expo web → :8584
npm start          # Expo dev menu
npm run android    # Android build/run
```

## Environment

Set `EXPO_PUBLIC_POS_API_URL=http://localhost:5000` for local API during development.

## Platform differences

| Platform | API | Printing |
|----------|-----|----------|
| Web / Electron | Hosted or local | `127.0.0.1:5000/api/local/print` |
| Android | Hosted API | Platform-specific (if configured) |
