# Environment Variables

## api-server

Create `api-server/.env` from `.env.example` if present.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | HTTP listen port |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | `posdb_adv` | Database name |
| `SESSION_SECRET` | dev fallback | Cookie signing secret (set in production) |
| `CORS_ORIGIN` | `*` or configured | Allowed origins for credentials |
| `NODE_ENV` | `development` | `production` enables stricter settings |

Upload paths for logos and product images are typically under `api-server/uploads/` (created at runtime).

## web-app

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_ONLINE_BASE_URL` | (empty) | Primary API host (e.g. `https://pos-api.lindalim.shop`) |
| `VITE_API_OFFLINE_BASE_URL` | (empty) | Fallback API when online is unreachable (e.g. `http://127.0.0.1:5000`) |
| `VITE_API_BASE_URL` | (empty) | Legacy single URL; used as online when `VITE_API_ONLINE_BASE_URL` is empty |
| `VITE_APP_THEME` | `theme1` | Admin UI theme |

### API failover

When **either** online or offline URL is set, `apiFetch` tries the online URL first. On a network failure (no HTTP response), it retries against the offline URL and sticks to whichever base last succeeded.

- If **both** online and offline are empty in dev, Vite proxies `/api` to `http://localhost:5000` (same-origin).
- Sessions are per host; users must sign in again after failover switches to a different API origin.
- Online and offline APIs should use the same database for consistent data.

Production build example:

```env
VITE_API_ONLINE_BASE_URL=https://pos-api.lindalim.shop
VITE_API_OFFLINE_BASE_URL=http://192.168.1.10:5000
```

## pos-mobile-expo

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_POS_API_URL` | `https://pos-api.lindalim.shop` | Primary API URL |
| `EXPO_PUBLIC_POS_API_URL_LOCAL` | `http://127.0.0.1:5000` | Local API for register PCs |

Expo only exposes variables prefixed with `EXPO_PUBLIC_` to the client bundle.

## pos-desktop

| Variable | Description |
|----------|-------------|
| `POS_API_PORT` | Local API port when spawned by Electron (default 5000) |
| `EXPO_WEB_PORT` | Expo web port (default 8584) |

Electron `main.js` may set child process env when starting bundled API and Expo.

## Production URLs (reference)

| Service | URL |
|---------|-----|
| API | `https://pos-api.lindalim.shop` |
| Web admin | `https://pos.lindalim.shop` |

## Security notes

- Never commit `.env` with real passwords or `SESSION_SECRET`.
- Use strong `SESSION_SECRET` in production.
- POS Bearer tokens are session-backed; treat API as trusted network boundary.
