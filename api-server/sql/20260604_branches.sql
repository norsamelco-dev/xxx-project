-- Multi-branch support: branches master table + branch_id on operational tables.
-- Prefer running via api-server startup (ensureBranchSchema.js) for idempotent migration.
-- This file documents the intended schema changes.

CREATE TABLE IF NOT EXISTS branches (
  branch_id   INT AUTO_INCREMENT PRIMARY KEY,
  branch_code VARCHAR(20)  NOT NULL UNIQUE,
  branch_name VARCHAR(100) NOT NULL,
  address     VARCHAR(255) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- After creating branches, seed MAIN from receipt_heading and backfill branch_id on:
-- users, receipt_heading, terminals_a, products, product_category, product_batches,
-- product_batches_template, product_batches_sync_history, sales_a, sales_b, sales_series,
-- cart, audit_logs, damage_*, procurement_*, suppliers, accounts_payable_payments

-- Unique constraint updates:
-- products: UNIQUE (branch_id, product_barcode)
-- terminals_a: UNIQUE (branch_id, machine_name|serial_number|min_number|ptu_number)
-- receipt_heading: UNIQUE (branch_id)
