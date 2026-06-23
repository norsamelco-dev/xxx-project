# API Server (`api-server`)

Express 5 REST API backing web admin and POS clients.

## Structure

```
api-server/
├── index.js              # App entry, middleware, route mounting
├── db/                   # Pool, schema bootstrap
├── middleware/           # Auth, branch context, audit
├── routes/               # Express routers per domain
├── services/             # Business logic
├── controllers/          # Thin controllers (audit, etc.)
├── sql/                  # Reference migrations
├── scripts/              # Test and utility scripts
└── api/
    ├── logos/            # Uploaded receipt logos
    └── product-images/   # Product images
```

## Startup sequence

1. Load `.env`, create Express app
2. CORS (credentials), JSON parser, static uploads
3. `express-session` cookie `linda.sid`
4. Request + audit loggers
5. Mount all `/api/*` routers
6. `ensureBranchSchema()`, checkout/receipt migrations
7. Listen on `PORT` (default 5000)

## Key services

### `posService.js`

- Terminal lookup and validation
- Product search with batch availability (FIFO)
- Cart CRUD
- `checkout()` — transactional insert to `sales_a`/`sales_b`, batch decrement, cart clear
- `buildReportPayload()` — X/Z totals scoped to series + cashier + machine
- Void sale / void line with stock restoration

### `procurementService.js`

Full PR → PO → GR → invoice → match → AP payment pipeline.

## Database access

`db/index.js` exports `getPool()` (mysql2 promise pool). Services use parameterized queries.

## Auth middleware

`middleware/requireAuth.js`:

- Web: validates `req.session.user`
- POS: validates `Authorization: Bearer` token mapped to session

`middleware/requireBranchContext.js`:

- Requires `branchId` on user; attaches to `req`

## Scripts

| Script | Use |
|--------|-----|
| `scripts/test-checkout-live.js` | Live checkout test |
| `scripts/test-x-report-scoped.js` | X report series scoping |

## Dev commands

```bash
npm run dev    # nodemon index.js
npm start      # node index.js
```

## Dependencies (main)

- `express`, `cors`, `express-session`
- `mysql2`
- `multer` (uploads)
- `dotenv`

## Windows printing

`routes/localPrinters.js` uses native Windows printing for ESC/POS bytes. Only meaningful when API runs on the register PC.
