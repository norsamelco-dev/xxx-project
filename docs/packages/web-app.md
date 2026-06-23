# Web Admin App (`web-app`)

React + TypeScript + Vite admin interface for back-office operations.

## Structure

```
web-app/
├── src/
│   ├── main.tsx           # Entry
│   ├── App.tsx            # Routes
│   ├── components/        # AdminShell, shared UI
│   ├── pages/             # Feature pages
│   ├── services/          # API clients
│   └── style.css          # Global styles, card grids
├── index.html
└── vite.config.ts         # Dev proxy to API
```

## Shell and navigation

`AdminShell.tsx` provides:

- Sidebar navigation (menu label **Dashboard** for analytics)
- Theme support (light/dark)
- User session display and logout

Page access is gated by user role / `pageAccess` from the session.

## Main pages

| Page | File | Purpose |
|------|------|---------|
| Dashboard | `DashboardXPage.tsx` | Sales analytics |
| Products | `ProductsPage.tsx` | Product catalog |
| Stock batch | `StockBatchPage.tsx` | FIFO batches |
| Users | `UsersPage.tsx` | User CRUD (card grid) |
| Branches | `BranchesPage.tsx` | Branch CRUD (card grid) |
| Machine / terminal | `MachineTerminalRegistrationPage.tsx` | BIR registration (card grid) |
| Receipt heading | `ReceiptHeadingPage.tsx` | Business profile; print logo modal |
| Audit logs | `AuditLogsPage.tsx` | Audit trail |
| Sales | `SalesPage.tsx` | Sales history |
| Damage reports | `DamageReportsPage.tsx` | Damage workflow |
| Procurement | Various | PR, PO, receiving, invoices |

## UI patterns

Recent UI uses **card grids** instead of wide tables for:

- Users, branches, terminals
- Grouped field rows with mini-cards inside terminal cards
- Consistent `audit-card-header` / `settings-form-grid` on settings pages

## API communication

- `fetch` or service modules with `credentials: 'include'`
- Base path `/api` (proxied in dev)

## Dev commands

```bash
npm run dev      # http://localhost:5173
npm run build    # Production bundle
npm run preview  # Preview build
```

## Theming

CSS variables in `style.css` for colors, cards, and responsive breakpoints. Dark mode via `data-theme` or class on root.

## Production

Build static assets and serve behind nginx or CDN. Point `VITE_API_URL` to production API host.

Default production URL: `https://pos.lindalim.shop`
