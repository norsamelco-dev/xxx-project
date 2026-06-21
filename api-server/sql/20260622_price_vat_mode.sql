-- Reference DDL for price VAT mode (applied idempotently via ensureReceiptHeadingVatMode.js)

ALTER TABLE receipt_heading
  ADD COLUMN price_vat_mode VARCHAR(12) NOT NULL DEFAULT 'INCLUSIVE' AFTER vat_rate;

ALTER TABLE sales_a
  ADD COLUMN sales_price_vat_mode VARCHAR(12) NULL DEFAULT NULL AFTER sales_vat_rate;

UPDATE sales_a
SET sales_price_vat_mode = 'INCLUSIVE'
WHERE sales_price_vat_mode IS NULL;
