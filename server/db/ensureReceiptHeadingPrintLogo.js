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

async function ensureReceiptHeadingPrintLogoColumns() {
  const pool = getPool();

  if (!(await columnExists('receipt_heading', 'print_logo_width'))) {
    await pool.query(
      `ALTER TABLE receipt_heading
       ADD COLUMN print_logo_width INT NOT NULL DEFAULT 240 AFTER business_logo_path`,
    );
    console.log('[receipt-heading] Added print_logo_width column');
  }

  if (!(await columnExists('receipt_heading', 'print_logo_align'))) {
    await pool.query(
      `ALTER TABLE receipt_heading
       ADD COLUMN print_logo_align VARCHAR(10) NOT NULL DEFAULT 'center' AFTER print_logo_width`,
    );
    console.log('[receipt-heading] Added print_logo_align column');
  }

  if (!(await columnExists('receipt_heading', 'print_logo_enabled'))) {
    await pool.query(
      `ALTER TABLE receipt_heading
       ADD COLUMN print_logo_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER print_logo_align`,
    );
    console.log('[receipt-heading] Added print_logo_enabled column');
  }
}

module.exports = { ensureReceiptHeadingPrintLogoColumns };
