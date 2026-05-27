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

async function indexExists(tableName, indexName) {
  const pool = getPool();
  const [rows] = await pool.query(`SHOW INDEX FROM ?? WHERE Key_name = ?`, [tableName, indexName]);
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

async function ensureCartTable() {
  const pool = getPool();

  if (!(await tableExists('cart'))) {
    await pool.query(
      `CREATE TABLE cart (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        BATCHID VARCHAR(255) NOT NULL,
        BARCODE VARCHAR(255) NOT NULL,
        DESCRIPTION VARCHAR(255) NOT NULL,
        BRAND VARCHAR(255) NOT NULL,
        UNIT VARCHAR(255) NOT NULL,
        QTY DECIMAL(12,2) NOT NULL DEFAULT 0,
        PRICE DECIMAL(12,2) NOT NULL DEFAULT 0,
        TOTAL DECIMAL(12,2) NOT NULL DEFAULT 0,
        USERID INT NOT NULL,
        UNIQUE KEY cart_user_line (USERID, BARCODE, BATCHID)
      )`,
    );
    console.log('[checkout-schema] Created cart table');
    return;
  }

  await ensureCartUniqueIndex();
}

async function ensureCartUniqueIndex() {
  const pool = getPool();

  await pool.query(
    `DELETE c1
     FROM cart c1
     INNER JOIN cart c2
       ON c1.USERID = c2.USERID
      AND c1.BARCODE = c2.BARCODE
      AND c1.BATCHID = c2.BATCHID
      AND c1.ID < c2.ID`,
  );

  if (!(await indexExists('cart', 'cart_user_line'))) {
    await pool.query(
      `ALTER TABLE cart
       ADD UNIQUE KEY cart_user_line (USERID, BARCODE, BATCHID)`,
    );
    console.log('[checkout-schema] Added unique index cart_user_line (USERID, BARCODE, BATCHID)');
  }
}

async function ensureSalesSeriesStartingBalance() {
  const pool = getPool();

  if (!(await tableExists('sales_series'))) {
    return;
  }

  if (!(await columnExists('sales_series', 'starting_balance'))) {
    await pool.query(
      `ALTER TABLE sales_series
       ADD COLUMN starting_balance DECIMAL(12,2) NULL AFTER seriesno`,
    );
    console.log('[checkout-schema] Added sales_series.starting_balance column');
  }
}

async function verifyCheckoutSchema() {
  const checks = {
    cart_table: await tableExists('cart'),
    cart_unique_index: (await tableExists('cart')) && (await indexExists('cart', 'cart_user_line')),
    sales_series_starting_balance:
      !(await tableExists('sales_series')) || (await columnExists('sales_series', 'starting_balance')),
  };

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
  };
}

async function ensureCheckoutSchema() {
  await ensureCartTable();
  await ensureSalesSeriesStartingBalance();
  return verifyCheckoutSchema();
}

module.exports = {
  ensureCartTable,
  ensureCartUniqueIndex,
  ensureSalesSeriesStartingBalance,
  ensureCheckoutSchema,
  verifyCheckoutSchema,
};
