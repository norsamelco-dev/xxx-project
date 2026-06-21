const { getPool } = require('../db');

async function columnExists(tableName, columnName) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function tableExists(tableName) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName],
  );
  return rows.length > 0;
}

async function ensureReceiptHeadingVatModeColumns() {
  const pool = getPool();

  if (await tableExists('receipt_heading')) {
    if (!(await columnExists('receipt_heading', 'price_vat_mode'))) {
      await pool.query(
        `ALTER TABLE receipt_heading
         ADD COLUMN price_vat_mode VARCHAR(12) NOT NULL DEFAULT 'INCLUSIVE' AFTER vat_rate`,
      );
      console.log('[receipt-heading] Added price_vat_mode column');
    }
  }

  if (await tableExists('sales_a')) {
    if (!(await columnExists('sales_a', 'sales_price_vat_mode'))) {
      await pool.query(
        `ALTER TABLE sales_a
         ADD COLUMN sales_price_vat_mode VARCHAR(12) NULL DEFAULT NULL AFTER sales_vat_rate`,
      );
      console.log('[sales-a] Added sales_price_vat_mode column');

      await pool.query(
        `UPDATE sales_a
         SET sales_price_vat_mode = 'INCLUSIVE'
         WHERE sales_price_vat_mode IS NULL`,
      );
      console.log('[sales-a] Backfilled sales_price_vat_mode to INCLUSIVE');
    }
  }
}

module.exports = {
  ensureReceiptHeadingVatModeColumns,
};
