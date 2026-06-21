const { getPool } = require('../db');

const BRANCH_SCOPED_TABLES = [
  'users',
  'receipt_heading',
  'terminals_a',
  'products',
  'product_category',
  'product_batches',
  'product_batches_template',
  'product_batches_sync_history',
  'sales_a',
  'sales_b',
  'sales_series',
  'cart',
  'audit_logs',
  'damage_reports',
  'damage_report_items',
  'damage_reason_options',
  'damage_report_sync_logs',
  'damage_report_sync_log_items',
  'damage_report_sync_log_batches',
  'suppliers',
  'purchase_requisitions',
  'purchase_requisition_items',
  'purchase_orders',
  'purchase_order_lines',
  'purchase_order_items',
  'receiving_reports',
  'receiving_report_items',
  'supplier_invoices',
  'supplier_invoice_items',
  'procurement_match_reviews',
  'accounts_payable_payments',
];

// Child/detail tables first — must include every BRANCH_SCOPED_TABLES entry exactly once.
const BRANCH_SCOPED_DELETE_ORDER = [
  'damage_report_sync_log_batches',
  'damage_report_sync_log_items',
  'damage_report_sync_logs',
  'damage_report_items',
  'damage_reports',
  'damage_reason_options',
  'accounts_payable_payments',
  'procurement_match_reviews',
  'supplier_invoice_items',
  'supplier_invoices',
  'receiving_report_items',
  'receiving_reports',
  'purchase_order_lines',
  'purchase_order_items',
  'purchase_orders',
  'purchase_requisition_items',
  'purchase_requisitions',
  'suppliers',
  'sales_b',
  'sales_a',
  'sales_series',
  'cart',
  'product_batches_sync_history',
  'product_batches_template',
  'product_batches',
  'products',
  'product_category',
  'terminals_a',
  'users',
  'receipt_heading',
  'audit_logs',
];

const scopedTableSet = new Set(BRANCH_SCOPED_TABLES);
const deleteOrderSet = new Set(BRANCH_SCOPED_DELETE_ORDER);
if (
  scopedTableSet.size !== deleteOrderSet.size
  || BRANCH_SCOPED_TABLES.some((tableName) => !deleteOrderSet.has(tableName))
) {
  throw new Error('BRANCH_SCOPED_DELETE_ORDER must include every BRANCH_SCOPED_TABLES entry exactly once.');
}

async function columnExists(tableName, columnName, executor = null) {
  const queryTarget = executor || getPool();
  const [rows] = await queryTarget.query(
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

async function tableExists(tableName, executor = null) {
  const queryTarget = executor || getPool();
  const [rows] = await queryTarget.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName],
  );
  return rows.length > 0;
}

async function dropIndexIfExists(tableName, indexName) {
  if (await indexExists(tableName, indexName)) {
    await getPool().query(`ALTER TABLE ?? DROP INDEX ??`, [tableName, indexName]);
    console.log(`[branch-schema] Dropped index ${tableName}.${indexName}`);
  }
}

async function ensureBranchesTable() {
  const pool = getPool();

  if (!(await tableExists('branches'))) {
    await pool.query(
      `CREATE TABLE branches (
        branch_id   INT AUTO_INCREMENT PRIMARY KEY,
        branch_code VARCHAR(20)  NOT NULL UNIQUE,
        branch_name VARCHAR(100) NOT NULL,
        address     VARCHAR(255) NULL,
        is_active   TINYINT(1)   NOT NULL DEFAULT 1,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    );
    console.log('[branch-schema] Created branches table');
  }
}

async function getDefaultBranchSeed() {
  const pool = getPool();

  if (await tableExists('receipt_heading')) {
    const [rows] = await pool.query(
      `SELECT busi_name, busi_addr FROM receipt_heading ORDER BY id ASC LIMIT 1`,
    );
    if (rows[0]) {
      return {
        branch_code: 'MAIN',
        branch_name: rows[0].busi_name || 'Main Branch',
        address: rows[0].busi_addr || null,
      };
    }
  }

  return {
    branch_code: 'MAIN',
    branch_name: 'Main Branch',
    address: null,
  };
}

async function ensureDefaultBranch() {
  const pool = getPool();
  const [existing] = await pool.query(`SELECT branch_id FROM branches ORDER BY branch_id ASC LIMIT 1`);

  if (existing.length > 0) {
    return existing[0].branch_id;
  }

  const seed = await getDefaultBranchSeed();
  const [result] = await pool.query(
    `INSERT INTO branches (branch_code, branch_name, address, is_active)
     VALUES (?, ?, ?, 1)`,
    [seed.branch_code, seed.branch_name, seed.address],
  );

  console.log(`[branch-schema] Seeded default branch "${seed.branch_code}" (id=${result.insertId})`);
  return result.insertId;
}

async function addBranchIdColumn(tableName, defaultBranchId) {
  if (!(await tableExists(tableName))) {
    return;
  }

  if (await columnExists(tableName, 'branch_id')) {
    return;
  }

  await getPool().query(
    `ALTER TABLE ?? ADD COLUMN branch_id INT NULL AFTER ${tableName === 'users' ? 'user_id' : tableName === 'receipt_heading' ? 'id' : tableName === 'terminals_a' ? 'ID' : tableName === 'products' ? 'product_id' : 'ID'}`,
    [tableName],
  );

  await getPool().query(`UPDATE ?? SET branch_id = ? WHERE branch_id IS NULL`, [tableName, defaultBranchId]);

  await getPool().query(`ALTER TABLE ?? MODIFY branch_id INT NOT NULL`, [tableName]);

  if (!(await indexExists(tableName, 'idx_branch_id'))) {
    await getPool().query(`ALTER TABLE ?? ADD INDEX idx_branch_id (branch_id)`, [tableName]);
  }

  console.log(`[branch-schema] Added branch_id to ${tableName}`);
}

async function addBranchIdColumnSafe(tableName, defaultBranchId) {
  if (!(await tableExists(tableName))) {
    return;
  }

  if (!(await columnExists(tableName, 'branch_id'))) {
    await getPool().query(`ALTER TABLE ?? ADD COLUMN branch_id INT NULL`, [tableName]);
    await getPool().query(`UPDATE ?? SET branch_id = ? WHERE branch_id IS NULL`, [tableName, defaultBranchId]);
    await getPool().query(`ALTER TABLE ?? MODIFY branch_id INT NOT NULL`, [tableName]);

    if (!(await indexExists(tableName, 'idx_branch_id'))) {
      await getPool().query(`ALTER TABLE ?? ADD INDEX idx_branch_id (branch_id)`, [tableName]);
    }

    console.log(`[branch-schema] Added branch_id to ${tableName}`);
  }
}

async function ensureBranchUniqueIndexes() {
  if (await tableExists('products')) {
    await dropIndexIfExists('products', 'product_barcode');
    if (!(await indexExists('products', 'products_branch_barcode'))) {
      await getPool().query(
        `ALTER TABLE products ADD UNIQUE KEY products_branch_barcode (branch_id, product_barcode)`,
      );
      console.log('[branch-schema] Added products_branch_barcode unique index');
    }
  }

  if (await tableExists('terminals_a')) {
    await dropIndexIfExists('terminals_a', 'unique_machine_name');
    await dropIndexIfExists('terminals_a', 'unique_serial_number');
    await dropIndexIfExists('terminals_a', 'unique_min_number');
    await dropIndexIfExists('terminals_a', 'unique_ptu_number');

    if (!(await indexExists('terminals_a', 'terminals_branch_machine_name'))) {
      await getPool().query(
        `ALTER TABLE terminals_a ADD UNIQUE KEY terminals_branch_machine_name (branch_id, machine_name)`,
      );
    }
    if (!(await indexExists('terminals_a', 'terminals_branch_serial_number'))) {
      await getPool().query(
        `ALTER TABLE terminals_a ADD UNIQUE KEY terminals_branch_serial_number (branch_id, serial_number)`,
      );
    }
    if (!(await indexExists('terminals_a', 'terminals_branch_min_number'))) {
      await getPool().query(
        `ALTER TABLE terminals_a ADD UNIQUE KEY terminals_branch_min_number (branch_id, min_number)`,
      );
    }
    if (!(await indexExists('terminals_a', 'terminals_branch_ptu_number'))) {
      await getPool().query(
        `ALTER TABLE terminals_a ADD UNIQUE KEY terminals_branch_ptu_number (branch_id, ptu_number)`,
      );
    }
    console.log('[branch-schema] Updated terminals_a branch-scoped unique indexes');
  }

  if (await tableExists('receipt_heading')) {
    if (!(await indexExists('receipt_heading', 'receipt_heading_branch_id'))) {
      await getPool().query(
        `ALTER TABLE receipt_heading ADD UNIQUE KEY receipt_heading_branch_id (branch_id)`,
      );
      console.log('[branch-schema] Added receipt_heading_branch_id unique index');
    }
  }
}

async function ensureBranchSchema() {
  await ensureBranchesTable();
  const defaultBranchId = await ensureDefaultBranch();

  for (const tableName of BRANCH_SCOPED_TABLES) {
    await addBranchIdColumnSafe(tableName, defaultBranchId);
  }

  await ensureBranchUniqueIndexes();
  return { ok: true, defaultBranchId };
}

module.exports = {
  BRANCH_SCOPED_TABLES,
  BRANCH_SCOPED_DELETE_ORDER,
  ensureBranchSchema,
  ensureDefaultBranch,
  tableExists,
  columnExists,
};
