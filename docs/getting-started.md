# Getting Started

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | LTS recommended |
| npm | 9+ | Comes with Node |
| MySQL | 8.x | Database `posdb_adv` (or configure via env) |
| Windows | 10/11 | Required for `pos-desktop` and local printing |

Optional: Android Studio / Expo Go for mobile POS testing.

## Database setup

1. Create MySQL database (default name: `posdb_adv`).
2. Import a baseline dump from `db_bak/` if starting fresh, **or** let the API bootstrap empty tables on first run.
3. Configure `api-server/.env` (see [Environment variables](environment-variables.md)).

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=posdb_adv
```

## Install dependencies

From the repository root, install each package:

```bash
cd api-server && npm install
cd ../web-app && npm install
cd ../pos-mobile-expo && npm install
cd ../pos-desktop && npm install
```

## Run development stack

### Terminal 1 — API server

```bash
cd api-server
npm run dev
```

Listens on **port 5000** by default. On startup you should see schema bootstrap messages and `API listening on port 5000`.

### Terminal 2 — Web admin

```bash
cd web-app
npm run dev
```

Opens at **http://localhost:5173**. Vite proxies `/api` to the API server.

### Terminal 3 — POS (browser or Electron)

**Browser only:**

```bash
cd pos-mobile-expo
npm run web
```

Opens at **http://localhost:8584**.

**Electron (register-like):**

```bash
cd pos-desktop
npm run dev
```

Starts Electron, may spawn local API and Expo web on port 8584.

## Verify installation

1. `GET http://localhost:5000/api/health` → `{ "ok": true }`
2. Log in to web admin with a user from the `users` table.
3. Log in to POS with a cashier user and registered terminal.

## Default credentials

Use credentials from your database import. Legacy passwords use **SHA-256** hex hashes in `users.password`.

## Test scripts (api-server)

| Script | Purpose |
|--------|---------|
| `node scripts/test-checkout-live.js` | End-to-end checkout against live API |
| `node scripts/test-x-report-scoped.js` | X report scoped to active sales series |

Run from `api-server/` with the API running and valid env.

## Common issues

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED` on API | Start `api-server`; check `DB_*` env |
| Web admin 401 | Clear cookies; re-login |
| POS cannot connect | Set `EXPO_PUBLIC_POS_API_URL` to `http://localhost:5000` |
| Printing fails on desktop | Ensure API on `127.0.0.1:5000`; see [Printing](printing.md) |

## Next steps

- [Environment variables](environment-variables.md)
- [Authentication](authentication.md)
- [POS terminal features](features/pos-terminal.md)
