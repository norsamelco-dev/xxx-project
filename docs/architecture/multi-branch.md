# Multi-Branch Model

## Overview

Each store location is a **branch**. Operational data (products, stock, sales, users, terminals, etc.) is scoped by `branch_id`. The API enforces branch context on authenticated routes via `requireBranchContext` middleware.

## Branches table

| Column | Description |
|--------|-------------|
| `branch_id` | Primary key |
| `branch_code` | Auto-generated code (e.g. `BR001`, `BR002`) |
| `branch_name` | Display name |
| `address` | Optional address |
| `is_active` | Active flag |

A default **MAIN** branch is seeded on first bootstrap if none exists.

## Branch-scoped tables

Defined in `api-server/db/ensureBranchSchema.js` as `BRANCH_SCOPED_TABLES`:

- **Auth & config:** `users`, `receipt_heading`, `terminals_a`, `audit_logs`
- **Inventory:** `products`, `product_category`, `product_batches`, `product_batches_template`, `product_batches_sync_history`
- **POS:** `cart`, `sales_series`, `sales_a`, `sales_b`
- **Damage:** `damage_reports`, `damage_report_items`, `damage_reason_options`, sync log tables
- **Procurement:** `suppliers`, requisitions, orders, receiving, invoices, match reviews, AP payments

Unique constraints often include `branch_id` (e.g. `(branch_id, product_barcode)`).

## User and terminal binding

- Each **user** has `branch_id` — they only see and modify data for that branch (admin users page can filter by branch).
- Each **terminal** (`terminals_a`) has `branch_id` — POS login validates the machine belongs to the user's branch.
- **Receipt heading** (business profile) is one row per branch.

## Branch deletion

Deleting a branch (`DELETE /api/branches/:branchId`) cascades through all branch-scoped tables in a defined order (`BRANCH_SCOPED_DELETE_ORDER`), then removes the branch row. Guards:

- Cannot delete the last branch
- Cannot delete the branch the current user is logged into
- Requires password confirmation (3 fields in UI)

Optional filesystem cleanup removes orphaned product images and receipt logos when unreferenced.

## POS implications

- Terminal lookup and checkout use the authenticated user's `branchId`.
- Product search and batch availability are branch-filtered.
- X/Z reports aggregate sales for the **active open sales series** for the logged-in cashier (not day-wide across all series).

## Web admin implications

- Most pages operate in the context of the logged-in user's branch.
- **Users** and **Branches** pages support multi-branch administration when the user has access.
- **DashboardX** and reports filter by branch via the session user.
