# Web Admin Features

## Dashboard

Sales and operational KPIs for the logged-in branch. Charts and summaries from `/api/dashboardx`.

Menu label: **Dashboard** (formerly DashboardX in code paths).

## Products

- CRUD products per branch
- Barcode uniqueness per branch
- Product image upload → `/api/product-images`
- Categories via `product_category`

## Stock batch (FIFO)

- Manage `product_batches` — qty, cost, expiry
- Template import and sync history
- Checkout consumes oldest batches first

## Users

- Card grid view with branch filter
- Create/edit users: username, full name, role, branch, page access
- Password set on create/update (SHA-256)

## Branches

- Card grid of branches
- Create with auto `branch_code`
- Edit name, address, active flag
- Delete with password confirmation and cascade (see multi-branch doc)

## Machine / terminal registration

- Card grid (3 columns desktop)
- Fields grouped: serial / machine ID / permit; OR range + current; valid dates
- OR range displayed as `{start} - {end}`

## Business profile (receipt heading)

- Company name, address, TIN, etc. per branch
- VAT mode (inclusive/exclusive) and rate
- Logo upload; **print logo on receipts** in modal (printer icon on header)
- Developer information card matches business card layout

## Audit logs

- Filterable list of API/admin actions
- User, action, entity, timestamp, branch

## Sales (admin)

- View sales history across series
- Detail and reporting for back office

## Damage reports

- Create damage reports with reason codes
- Line items from product/batch
- Sync logs for mobile/offline workflows if used

## Procurement

See [Procurement workflow](procurement.md).

## Theming

Light/dark themes via AdminShell; consistent card and form styles in `style.css`.

## Access control

Sidebar items hidden based on user `pageAccess`. Unauthorized routes redirect or show error.
