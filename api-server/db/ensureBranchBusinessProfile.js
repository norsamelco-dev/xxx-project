const { getPool } = require('../db');
const { columnExists, tableExists } = require('./ensureBranchSchema');

const BUSINESS_COLUMNS = [
  { name: 'busi_name', definition: 'VARCHAR(45) NULL' },
  { name: 'busi_addr', definition: 'VARCHAR(200) NULL' },
  { name: 'busi_owner', definition: 'VARCHAR(100) NULL' },
  { name: 'busi_vat_type', definition: 'VARCHAR(45) NULL' },
  { name: 'busi_tin', definition: 'VARCHAR(45) NULL' },
  { name: 'vat_rate', definition: 'DECIMAL(5,2) DEFAULT 12.00' },
  { name: 'price_vat_mode', definition: "VARCHAR(12) NOT NULL DEFAULT 'INCLUSIVE'" },
  { name: 'business_logo_path', definition: 'VARCHAR(500) NULL' },
];

async function ensureBusinessColumns() {
  const pool = getPool();

  if (!(await tableExists('branches'))) {
    return;
  }

  for (const column of BUSINESS_COLUMNS) {
    if (!(await columnExists('branches', column.name))) {
      await pool.query(`ALTER TABLE branches ADD COLUMN ${column.name} ${column.definition}`);
      console.log(`[branch-business] Added branches.${column.name}`);
    }
  }
}

async function backfillBusinessProfileFromReceiptHeading() {
  const pool = getPool();

  if (!(await tableExists('branches')) || !(await columnExists('branches', 'busi_name'))) {
    return;
  }

  if (await tableExists('receipt_heading')) {
    await pool.query(
      `UPDATE branches b
       LEFT JOIN receipt_heading rh ON rh.branch_id = b.branch_id
       SET b.busi_name = COALESCE(rh.busi_name, b.branch_name),
           b.busi_addr = COALESCE(rh.busi_addr, b.address),
           b.busi_owner = rh.busi_owner,
           b.busi_vat_type = rh.busi_vat_type,
           b.busi_tin = rh.busi_tin,
           b.vat_rate = COALESCE(rh.vat_rate, 12.00),
           b.price_vat_mode = COALESCE(rh.price_vat_mode, 'INCLUSIVE'),
           b.business_logo_path = rh.business_logo_path
       WHERE b.busi_name IS NULL`,
    );
    console.log('[branch-business] Backfilled business profile from receipt_heading');
  }

  await pool.query(
    `UPDATE branches
     SET busi_name = COALESCE(busi_name, branch_name),
         busi_addr = COALESCE(busi_addr, address),
         vat_rate = COALESCE(vat_rate, 12.00),
         price_vat_mode = COALESCE(price_vat_mode, 'INCLUSIVE')
     WHERE busi_name IS NULL`,
  );
}

async function ensureBranchBusinessProfile() {
  await ensureBusinessColumns();
  await backfillBusinessProfileFromReceiptHeading();
  return { ok: true };
}

module.exports = {
  ensureBranchBusinessProfile,
};
