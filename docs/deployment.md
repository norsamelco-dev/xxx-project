# Deployment

## Environments

| Environment | API | Web admin | POS |
|-------------|-----|-----------|-----|
| Development | `localhost:5000` | `localhost:5173` | `localhost:8584` |
| Production | `pos-api.lindalim.shop` | `pos.lindalim.shop` | Electron + hosted API |

## API server (production)

1. Node 18+ on server (Linux or Windows)
2. MySQL reachable with production credentials
3. Set environment:

```env
NODE_ENV=production
PORT=5000
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=posdb_adv
SESSION_SECRET=<strong-random>
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=none
TRUST_PROXY=true
```

4. Process manager: `pm2`, systemd, or IIS Node
5. Reverse proxy (nginx/Caddy) with HTTPS
6. Persist `api/logos` and `api/product-images` uploads

### Health monitoring

Monitor `GET /api/health`. Log rotation for request/audit logs.

## Web admin (production)

```bash
cd web-app
VITE_API_URL=https://pos-api.lindalim.shop npm run build
```

Serve `dist/` via nginx static hosting or CDN. Configure SPA fallback to `index.html`.

CORS on API must allow `https://pos.lindalim.shop` with credentials.

## POS desktop (register PCs)

1. Build installer: `cd pos-desktop && npm run build`
2. Install on each register
3. Configure:
   - `EXPO_PUBLIC_POS_API_URL` → production API
   - Local API on 5000 for printing (bundled or separate service)
4. Register terminal in web admin; assign branch
5. Create cashier users per branch
6. Install and name receipt printer in Windows

### Register network

- Outbound HTTPS to API host required
- Localhost 5000 for print only (no inbound from internet)

## Database

- Regular MySQL backups (mysqldump)
- Reference dumps in `db_bak/` — not auto-restored
- Schema evolves via API bootstrap + `api-server/sql/` migrations

## SSL and cookies

Production web admin needs:

- HTTPS on both admin and API sites (or same-site proxy)
- `SESSION_COOKIE_SECURE=true`
- `SameSite=None` if cross-subdomain cookies

## Scaling notes

- Single MySQL instance is typical; read replicas optional for reporting
- Stateless API instances behind load balancer share session store (consider Redis session store if scaling horizontally — current default is in-memory session)
- File uploads must be on shared storage if multiple API nodes

## Rollback

- Keep previous API build and web `dist` backup
- Database migrations should be backward-compatible or paired with down scripts

## Checklist

- [ ] MySQL backed up
- [ ] SESSION_SECRET set
- [ ] HTTPS enabled
- [ ] CORS origins restricted
- [ ] Terminals registered per branch
- [ ] Receipt heading and VAT configured per branch
- [ ] Register printer tested end-to-end
