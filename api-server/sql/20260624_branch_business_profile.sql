-- Per-branch business profile columns on branches (migrated from receipt_heading).
-- Prefer running via api-server startup (ensureBranchBusinessProfile.js) for idempotent migration.

ALTER TABLE branches ADD COLUMN busi_name VARCHAR(45) NULL;
ALTER TABLE branches ADD COLUMN busi_addr VARCHAR(200) NULL;
ALTER TABLE branches ADD COLUMN busi_owner VARCHAR(100) NULL;
ALTER TABLE branches ADD COLUMN busi_vat_type VARCHAR(45) NULL;
ALTER TABLE branches ADD COLUMN busi_tin VARCHAR(45) NULL;
ALTER TABLE branches ADD COLUMN vat_rate DECIMAL(5,2) DEFAULT 12.00;
ALTER TABLE branches ADD COLUMN price_vat_mode VARCHAR(12) NOT NULL DEFAULT 'INCLUSIVE';
ALTER TABLE branches ADD COLUMN business_logo_path VARCHAR(500) NULL;

UPDATE branches b
LEFT JOIN receipt_heading rh ON rh.branch_id = b.branch_id
SET b.busi_name = COALESCE(rh.busi_name, b.branch_name),
    b.busi_addr = COALESCE(rh.busi_addr, b.address),
    b.busi_owner = rh.busi_owner,
    b.busi_vat_type = rh.busi_vat_type,
    b.busi_tin = rh.busi_tin,
    b.vat_rate = COALESCE(rh.vat_rate, 12.00),
    b.price_vat_mode = COALESCE(rh.price_vat_mode, 'INCLUSIVE'),
    b.business_logo_path = rh.business_logo_path;

UPDATE branches
SET busi_name = COALESCE(busi_name, branch_name),
    busi_addr = COALESCE(busi_addr, address),
    vat_rate = COALESCE(vat_rate, 12.00),
    price_vat_mode = COALESCE(price_vat_mode, 'INCLUSIVE')
WHERE busi_name IS NULL;
