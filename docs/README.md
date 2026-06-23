# Linda LIM POS — System Documentation

Multi-package Point of Sale system for retail operations with multi-branch support, BIR-compliant terminal registration, inventory, procurement, and analytics.

## Documentation index

| Document | Description |
|----------|-------------|
| [Architecture overview](architecture/overview.md) | System components, data flow, and how packages connect |
| [Multi-branch model](architecture/multi-branch.md) | Branch scoping, schema, and data isolation |
| [Getting started](getting-started.md) | Prerequisites, install, and first run |
| [Environment variables](environment-variables.md) | Configuration for all packages |
| [Authentication & authorization](authentication.md) | Web sessions, POS tokens, roles, page access |
| [Database schema](database/schema.md) | Tables, relationships, and schema bootstrap |
| [API overview](api/overview.md) | Route groups, auth requirements, key endpoints |
| [API server](packages/api-server.md) | Express backend, services, middleware |
| [Web admin app](packages/web-app.md) | React admin UI, routes, themes |
| [POS mobile / Expo](packages/pos-mobile-expo.md) | Terminal UI, screens, checkout flow |
| [POS desktop](packages/pos-desktop.md) | Electron wrapper, Windows deployment |
| [POS terminal features](features/pos-terminal.md) | Sales series, checkout, X/Z, void |
| [Web admin features](features/web-admin.md) | Inventory, users, branches, reports |
| [Procurement workflow](features/procurement.md) | PR → PO → receiving → invoice → AP |
| [Printing](printing.md) | Receipts, X/Z, local Windows printer API |
| [Deployment](deployment.md) | Dev, production, and register PC setup |

## Repository layout

```
LINDA_LIM_POS/
├── api-server/          # Central REST API (Express + MySQL)
├── web-app/             # Admin web UI (React + Vite)
├── pos-mobile-expo/     # POS terminal UI (Expo / React Native)
├── pos-desktop/         # Windows Electron shell for registers
├── db_bak/              # MySQL dumps (reference / backup only)
└── docs/                # This documentation
```

## Quick reference

| Package | Dev command | Default URL |
|---------|-------------|-------------|
| API server | `npm run dev` in `api-server/` | `http://localhost:5000` |
| Web admin | `npm run dev` in `web-app/` | `http://localhost:5173` |
| POS (web) | `npm run web` in `pos-mobile-expo/` | `http://localhost:8584` |
| POS desktop | `npm run dev` in `pos-desktop/` | Electron + above |

**Health check:** `GET /api/health`

**Production API (default POS):** `https://pos-api.lindalim.shop`
