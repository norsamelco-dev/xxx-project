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
| `VITE_API_URL` | (proxy) | API base URL; dev often uses Vite proxy to `/api` |

Production build: point `VITE_API_URL` to `https://pos-api.lindalim.shop` or your host.

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
