# API Overview

Base URL: `/api` (e.g. `http://localhost:5000/api`)

## Health and diagnostics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | `{ ok: true }` |
| GET | `/api/db-check` | No | DB connectivity (dev) |

## Route groups

| Prefix | Router file | Purpose |
|--------|-------------|---------|
| `/api/auth` | `routes/auth.js` | Login, logout, session user |
| `/api/receipt-heading` | `routes/receiptHeading.js` | Business profile, public heading |
| `/api/machine-terminal-registration` | `routes/machineTerminalRegistration.js` | BIR terminals CRUD |
| `/api/audit-logs` | `routes/auditLogs.js` | Audit trail query |
| `/api/products` | `routes/products.js` | Product CRUD, images |
| `/api/stock-batch` | `routes/stockBatch.js` | Batch inventory |
| `/api/damage-reports` | `routes/damageReports.js` | Damage reporting |
| `/api/users` | `routes/users.js` | User management |
| `/api/sales` | `routes/sales.js` | Admin sales views |
| `/api/dashboardx` | `routes/dashboardX.js` | Dashboard analytics |
| `/api/procurement` | `routes/procurement.js` | PR/PO/receiving/AP |
| `/api/pos` | `routes/pos.js` | Terminal operations |
| `/api/branches` | `routes/branches.js` | Branch CRUD |
| `/api/local` | `routes/localPrinters.js` | Windows printer list/print |

Static assets:

- `/api/logos` — receipt logos
- `/api/product-images` — product photos

## POS routes (`/api/pos`)

All require POS auth (Bearer) unless noted.

### Terminal & catalog

| Method | Path | Description |
|--------|------|-------------|
| GET | `/terminals/lookup` | Resolve machine by name/serial |
| GET | `/products/lookup` | Barcode lookup |
| GET | `/products/search` | Text search |

### Sales series

| Method | Path | Description |
|--------|------|-------------|
| GET | `/series/active` | Current open series for user/machine |
| POST | `/series` | Open new series |
| GET | `/series/:seriesNo/starting-balance` | Get starting cash |
| POST | `/series/:seriesNo/starting-balance` | Set starting cash |
| GET | `/series/:seriesNo/close-requirements` | Pre-close checks |
| POST | `/series/:seriesNo/close` | Close series (Z) |
| POST | `/series/:seriesNo/reports/printed` | Mark report printed |

### Cart & checkout

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cart` | List cart lines |
| POST | `/cart/add` | Add by barcode/qty |
| POST | `/cart/line` | Update line qty |
| POST | `/cart/line/remove` | Remove line |
| POST | `/cart/clear` | Clear cart |
| POST | `/checkout` | Finalize sale → `sales_a` / `sales_b` |

### Transactions & voids

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sales/series` | List series |
| GET | `/sales/series/:seriesNo/transactions` | Transactions in series |
| GET | `/sales/transactions/:orsi/items` | Line items |
| POST | `/sales/transactions/:orsi/void` | Void entire sale |
| POST | `/sales/transactions/:orsi/items/:itemId/void` | Void line |
| GET | `/sales/transactions/:orsi/receipt` | Receipt reprint data |

### Reports

| Method | Path | Query/body | Description |
|--------|------|------------|-------------|
| GET | `/reports/x` | `machineName`, `sales_series_no` | X reading (open series only) |
| POST | `/reports/z` | `machineName`, `sales_series_no` | Z reading + close series |

**X/Z scoping:** Totals are for the **active open sales series** owned by the logged-in cashier on the given machine. Closed series return 409.

### Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/summary` | Shift summary for UI |

## Local printing (`/api/local`)

Typically **localhost only** on register PCs.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/printers` | List Windows printer names |
| POST | `/print` | Raw ESC/POS payload to named printer |

## Error responses

Standard JSON: `{ error: string, message?: string }` with HTTP status:

| Code | Meaning |
|------|---------|
| 400 | Validation / bad input |
| 401 | Not authenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (e.g. closed series, duplicate) |
| 500 | Server error |

## Middleware

- `requireAuth` — session or Bearer
- `requireBranchContext` — sets `req.branchId`
- `auditLogger` — records mutations
- `requestLogger` — access log

## Service layer

Business logic lives in `api-server/services/`:

- `posService.js` — cart, checkout, series, reports, voids
- `procurementService.js` — procurement workflow
- Others per domain

Controllers in `controllers/` are thin wrappers for some admin routes.
