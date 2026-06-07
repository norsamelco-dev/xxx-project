const { randomUUID } = require('crypto');
const { getPool } = require('../db');

const DAMAGE_REPORTS_TABLE = 'damage_reports';
const DAMAGE_REPORT_ITEMS_TABLE = 'damage_report_items';
const DAMAGE_SYNC_LOGS_TABLE = 'damage_report_sync_logs';
const DAMAGE_SYNC_LOG_ITEMS_TABLE = 'damage_report_sync_log_items';
const DAMAGE_SYNC_LOG_BATCHES_TABLE = 'damage_report_sync_log_batches';
const DAMAGE_REASON_OPTIONS_TABLE = 'damage_reason_options';

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeInteger(value, fieldName, { min = 1 } = {}) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(`${fieldName} is required.`);
    error.statusCode = 400;
    throw error;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min) {
    const error = new Error(`${fieldName} must be a whole number${min > 0 ? ` greater than or equal to ${min}` : ''}.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function normalizeDateFilter(value, fieldName) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format.`);
    error.statusCode = 400;
    throw error;
  }

  return text;
}

function mapReportRow(row) {
  return {
    id: row.id,
    report_number: row.report_number,
    status: row.status,
    remarks: row.remarks,
    created_by_user_id: row.created_by_user_id,
    created_by_username: row.created_by_username,
    created_at: row.created_at,
    synced_by_user_id: row.synced_by_user_id,
    synced_by_username: row.synced_by_username,
    synced_at: row.synced_at,
    item_count: Number(row.item_count || 0),
  };
}

function mapItemRow(row) {
  return {
    id: row.id,
    damage_report_id: row.damage_report_id,
    product_id: row.product_id,
    product_name: row.product_name,
    sku: row.sku,
    product_barcode: row.product_barcode,
    qty_damaged: Number(row.qty_damaged || 0),
    damage_reason: row.damage_reason,
    remarks: row.remarks,
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getSessionIdentity(sessionUser) {
  return {
    userId: normalizeText(sessionUser?.userId),
    username: normalizeText(sessionUser?.username) || normalizeText(sessionUser?.fullName),
  };
}

async function ensureDamageReportTables(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${DAMAGE_REASON_OPTIONS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      reason_code VARCHAR(50) NOT NULL,
      reason_label VARCHAR(100) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      UNIQUE KEY uq_damage_reason_code (reason_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `INSERT IGNORE INTO ${DAMAGE_REASON_OPTIONS_TABLE} (reason_code, reason_label, sort_order) VALUES
      ('rat_damage', 'Rat damage', 1),
      ('flood', 'Flood', 2),
      ('expired', 'Expired', 3),
      ('accident', 'Accident', 4),
      ('other', 'Other', 99)`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${DAMAGE_REPORTS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      report_number VARCHAR(30) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      remarks TEXT NULL,
      created_by_user_id VARCHAR(45) DEFAULT NULL,
      created_by_username VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      synced_by_user_id VARCHAR(45) DEFAULT NULL,
      synced_by_username VARCHAR(255) DEFAULT NULL,
      synced_at DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_damage_report_number (report_number),
      KEY idx_damage_reports_status (status),
      KEY idx_damage_reports_created_at (created_at),
      KEY idx_damage_reports_synced_at (synced_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${DAMAGE_REPORT_ITEMS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      damage_report_id INT NOT NULL,
      product_id INT DEFAULT NULL,
      product_name VARCHAR(500) NOT NULL,
      sku VARCHAR(100) NOT NULL,
      product_barcode VARCHAR(100) NOT NULL,
      qty_damaged INT NOT NULL,
      damage_reason VARCHAR(100) NOT NULL,
      remarks TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_damage_report_items_report (damage_report_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${DAMAGE_SYNC_LOGS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      damage_report_id INT NOT NULL,
      report_number VARCHAR(30) NOT NULL,
      sync_batch_id VARCHAR(64) NOT NULL,
      synced_by_user_id VARCHAR(45) DEFAULT NULL,
      synced_by_username VARCHAR(255) DEFAULT NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) NOT NULL,
      error_summary TEXT NULL,
      warnings_json TEXT NULL,
      PRIMARY KEY (id),
      KEY idx_damage_sync_logs_report (damage_report_id),
      KEY idx_damage_sync_logs_batch (sync_batch_id),
      KEY idx_damage_sync_logs_synced_at (synced_at),
      KEY idx_damage_sync_logs_report_number (report_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${DAMAGE_SYNC_LOG_ITEMS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      sync_log_id INT NOT NULL,
      damage_report_item_id INT DEFAULT NULL,
      product_name VARCHAR(500) NOT NULL,
      sku VARCHAR(100) NOT NULL,
      product_barcode VARCHAR(100) NOT NULL,
      qty_requested INT NOT NULL DEFAULT 0,
      qty_deducted INT NOT NULL DEFAULT 0,
      damage_reason VARCHAR(100) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_damage_sync_log_items_log (sync_log_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${DAMAGE_SYNC_LOG_BATCHES_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      sync_log_item_id INT NOT NULL,
      product_batch_id INT NOT NULL,
      batch_id VARCHAR(100) DEFAULT NULL,
      cost_price DECIMAL(10,2) DEFAULT NULL,
      qty_before INT NOT NULL DEFAULT 0,
      qty_deducted INT NOT NULL DEFAULT 0,
      qty_after INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_damage_sync_log_batches_item (sync_log_item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );
}

async function getReportById(connection, reportId, { forUpdate = false, branchId } = {}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(
    `SELECT id, report_number, status, remarks,
            created_by_user_id, created_by_username, created_at,
            synced_by_user_id, synced_by_username, synced_at
     FROM ${DAMAGE_REPORTS_TABLE}
     WHERE id = ?
       AND branch_id = ?${lockClause}`,
    [reportId, branchId],
  );

  return rows[0] || null;
}

async function assertDraftReport(connection, reportId, branchId) {
  const report = await getReportById(connection, reportId, { forUpdate: true, branchId });

  if (!report) {
    const error = new Error('Damage report not found.');
    error.statusCode = 404;
    throw error;
  }

  if (report.status !== 'draft') {
    const error = new Error('Only draft damage reports can be modified.');
    error.statusCode = 409;
    throw error;
  }

  return report;
}

async function buildDraftReportNumber(connection, branchId) {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(report_number, 12) AS UNSIGNED)), 0) AS max_sequence
     FROM ${DAMAGE_REPORTS_TABLE}
     WHERE report_number LIKE 'DR-DRAFT-%'
       AND branch_id = ?`,
    [branchId],
  );

  const nextSequence = Number(rows[0]?.max_sequence || 0) + 1;
  return `DR-DRAFT-${String(nextSequence).padStart(3, '0')}`;
}

async function buildFinalReportNumber(connection, branchId) {
  const year = new Date().getFullYear();
  const prefix = `DR-${year}-`;

  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(report_number, ?) AS UNSIGNED)), 0) AS max_sequence
     FROM ${DAMAGE_REPORTS_TABLE}
     WHERE report_number LIKE ?
       AND branch_id = ?`,
    [prefix.length + 1, `${prefix}%`, branchId],
  );

  const nextSequence = Number(rows[0]?.max_sequence || 0) + 1;
  return `${prefix}${String(nextSequence).padStart(3, '0')}`;
}

async function getProductByLookup(connection, lookup, branchId) {
  const normalized = normalizeText(lookup);

  if (!normalized) {
    const error = new Error('Product lookup value is required.');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await connection.query(
    `SELECT p.product_id,
            p.product_barcode,
            p.product_name,
            COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS available_qty
     FROM products p
     LEFT JOIN product_batches pb
       ON pb.product_barcode = p.product_barcode
      AND pb.branch_id = p.branch_id
      AND COALESCE(pb.Block, 0) = 0
     WHERE p.branch_id = ?
       AND (p.product_barcode = ?
        OR p.product_barcode LIKE CONCAT(?, '%')
        OR p.product_name LIKE CONCAT('%', ?, '%'))
     GROUP BY p.product_id, p.product_barcode, p.product_name
     ORDER BY
       CASE WHEN p.product_barcode = ? THEN 0 ELSE 1 END,
       p.product_name ASC
     LIMIT 1`,
    [branchId, normalized, normalized, normalized, normalized],
  );

  if (!rows.length) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  const row = rows[0];
  return {
    product_id: row.product_id,
    product_barcode: row.product_barcode,
    product_name: row.product_name,
    sku: row.product_barcode,
    available_qty: Number(row.available_qty || 0),
  };
}

function mapDamageReportProductRow(row) {
  return {
    product_id: row.product_id,
    product_barcode: row.product_barcode,
    product_name: row.product_name,
    category: row.category,
    brand: row.brand,
    unit: row.unit,
    product_image_path: row.product_image_path,
    sku: row.product_barcode,
    available_qty: Number(row.available_qty || 0),
  };
}

async function listDamageReportProducts(branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const [rows] = await pool.query(
    `SELECT p.product_id,
            p.product_barcode,
            p.product_name,
            p.category,
            p.brand,
            p.unit,
            p.product_image_path,
            COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS available_qty
     FROM products p
     LEFT JOIN product_batches pb
       ON pb.product_barcode = p.product_barcode
      AND pb.branch_id = p.branch_id
      AND COALESCE(pb.Block, 0) = 0
     WHERE p.branch_id = ?
       AND p.product_barcode IS NOT NULL
       AND TRIM(p.product_barcode) <> ''
     GROUP BY p.product_id, p.product_barcode, p.product_name, p.category, p.brand, p.unit, p.product_image_path
     ORDER BY p.product_name ASC, p.product_barcode ASC`,
    [branchId],
  );

  return rows.map(mapDamageReportProductRow);
}

async function lookupDamageReportProductByBarcode(barcode, branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const normalized = normalizeText(barcode);

  if (!normalized) {
    const error = new Error('Barcode is required.');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await pool.query(
    `SELECT p.product_id,
            p.product_barcode,
            p.product_name,
            p.category,
            p.brand,
            p.unit,
            p.product_image_path,
            COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS available_qty
     FROM products p
     LEFT JOIN product_batches pb
       ON pb.product_barcode = p.product_barcode
      AND pb.branch_id = p.branch_id
      AND COALESCE(pb.Block, 0) = 0
     WHERE p.product_barcode = ?
       AND p.branch_id = ?
     GROUP BY p.product_id, p.product_barcode, p.product_name, p.category, p.brand, p.unit, p.product_image_path`,
    [normalized, branchId],
  );

  if (!rows.length) {
    const error = new Error('No matching product found.');
    error.statusCode = 404;
    throw error;
  }

  return mapDamageReportProductRow(rows[0]);
}

async function fetchLofoBatches(connection, productBarcode, branchId, { forUpdate = false } = {}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : '';

  const [rows] = await connection.query(
    `SELECT id, batch_id, cost_price, COALESCE(Qty, 0) AS qty
     FROM product_batches
     WHERE product_barcode = ?
       AND branch_id = ?
       AND COALESCE(Block, 0) = 0
       AND COALESCE(Qty, 0) > 0
     ORDER BY cost_price ASC, id ASC${lockClause}`,
    [productBarcode, branchId],
  );

  return rows.map((row) => ({
    product_batch_id: row.id,
    batch_id: row.batch_id,
    cost_price: row.cost_price !== null && row.cost_price !== undefined ? Number(row.cost_price) : null,
    qty: Number(row.qty || 0),
  }));
}

function allocateLofoFromBatches(batches, qtyDamaged) {
  let remaining = qtyDamaged;
  const allocations = [];

  for (const batch of batches) {
    if (remaining <= 0) {
      break;
    }

    const take = Math.min(remaining, batch.qty);

    if (take <= 0) {
      continue;
    }

    allocations.push({
      product_batch_id: batch.product_batch_id,
      batch_id: batch.batch_id,
      cost_price: batch.cost_price,
      qty_before: batch.qty,
      qty_deducted: take,
      qty_after: batch.qty - take,
    });

    remaining -= take;
  }

  const totalAvailable = batches.reduce((sum, batch) => sum + batch.qty, 0);

  return {
    allocations,
    qty_deducted: qtyDamaged - remaining,
    remaining,
    insufficient: remaining > 0,
    total_available: totalAvailable,
  };
}

async function buildLinePreview(connection, item, branchId) {
  const barcode = normalizeText(item.product_barcode);
  const qtyDamaged = Number(item.qty_damaged || 0);
  const batches = await fetchLofoBatches(connection, barcode, branchId);
  const allocation = allocateLofoFromBatches(batches, qtyDamaged);

  return {
    item_id: item.id,
    product_name: item.product_name,
    sku: item.sku,
    product_barcode: item.product_barcode,
    qty_damaged: qtyDamaged,
    damage_reason: item.damage_reason,
    remarks: item.remarks,
    total_available: allocation.total_available,
    insufficient: allocation.insufficient,
    shortfall: allocation.insufficient ? allocation.remaining : 0,
    allocations: allocation.allocations,
    can_sync: !allocation.insufficient && qtyDamaged > 0,
  };
}

function mapReasonOptionRow(row) {
  return {
    id: row.id,
    reason_code: row.reason_code,
    reason_label: row.reason_label,
    sort_order: Number(row.sort_order || 0),
    is_active: Number(row.is_active ?? 1),
  };
}

function normalizeReasonCode(value) {
  const text = normalizeText(value);

  if (!text) {
    const error = new Error('reason_code is required.');
    error.statusCode = 400;
    throw error;
  }

  if (text.length > 50) {
    const error = new Error('reason_code must be at most 50 characters.');
    error.statusCode = 400;
    throw error;
  }

  if (!/^[a-z0-9_]+$/.test(text)) {
    const error = new Error('reason_code must use lowercase letters, numbers, and underscores only.');
    error.statusCode = 400;
    throw error;
  }

  return text;
}

function normalizeReasonLabel(value) {
  const text = normalizeText(value);

  if (!text) {
    const error = new Error('reason_label is required.');
    error.statusCode = 400;
    throw error;
  }

  if (text.length > 100) {
    const error = new Error('reason_label must be at most 100 characters.');
    error.statusCode = 400;
    throw error;
  }

  return text;
}

function normalizeBooleanFlag(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (value === 1 || value === '1' || value === 'true') {
    return 1;
  }

  if (value === 0 || value === '0' || value === 'false') {
    return 0;
  }

  const error = new Error(`${fieldName} must be a boolean value.`);
  error.statusCode = 400;
  throw error;
}

async function getDamageReasonOptionById(pool, optionId, branchId) {
  const [rows] = await pool.query(
    `SELECT id, reason_code, reason_label, sort_order, is_active
     FROM ${DAMAGE_REASON_OPTIONS_TABLE}
     WHERE id = ?
       AND branch_id = ?`,
    [optionId, branchId],
  );

  if (!rows.length) {
    const error = new Error('Damage reason option not found.');
    error.statusCode = 404;
    throw error;
  }

  return mapReasonOptionRow(rows[0]);
}

async function listDamageReasonOptions(branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const [rows] = await pool.query(
    `SELECT id, reason_code, reason_label, sort_order
     FROM ${DAMAGE_REASON_OPTIONS_TABLE}
     WHERE is_active = 1
       AND branch_id = ?
     ORDER BY sort_order ASC, reason_label ASC`,
    [branchId],
  );

  return rows;
}

async function listAllDamageReasonOptions(branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const [rows] = await pool.query(
    `SELECT id, reason_code, reason_label, sort_order, is_active
     FROM ${DAMAGE_REASON_OPTIONS_TABLE}
     WHERE branch_id = ?
     ORDER BY sort_order ASC, reason_label ASC`,
    [branchId],
  );

  return rows.map(mapReasonOptionRow);
}

async function createDamageReasonOption(payload = {}, branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const reasonCode = normalizeReasonCode(payload.reason_code);
  const reasonLabel = normalizeReasonLabel(payload.reason_label);

  const [maxRows] = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
     FROM ${DAMAGE_REASON_OPTIONS_TABLE}
     WHERE branch_id = ?`,
    [branchId],
  );

  const sortOrder = payload.sort_order !== undefined
    ? normalizeInteger(payload.sort_order, 'sort_order', { min: 0 })
    : Number(maxRows[0]?.max_sort || 0) + 1;

  const isActive = normalizeBooleanFlag(payload.is_active, 'is_active');
  const resolvedIsActive = isActive === null ? 1 : isActive;

  try {
    const [result] = await pool.query(
      `INSERT INTO ${DAMAGE_REASON_OPTIONS_TABLE}
        (reason_code, reason_label, sort_order, is_active, branch_id)
       VALUES (?, ?, ?, ?, ?)`,
      [reasonCode, reasonLabel, sortOrder, resolvedIsActive, branchId],
    );

    return getDamageReasonOptionById(pool, result.insertId, branchId);
  } catch (insertError) {
    if (insertError.code === 'ER_DUP_ENTRY') {
      const error = new Error(`reason_code "${reasonCode}" already exists.`);
      error.statusCode = 409;
      throw error;
    }

    throw insertError;
  }
}

async function updateDamageReasonOption(id, payload = {}, branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const optionId = normalizeInteger(id, 'option_id', { min: 1 });
  await getDamageReasonOptionById(pool, optionId, branchId);

  const updates = [];
  const params = [];

  if (payload.reason_label !== undefined) {
    updates.push('reason_label = ?');
    params.push(normalizeReasonLabel(payload.reason_label));
  }

  if (payload.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(normalizeInteger(payload.sort_order, 'sort_order', { min: 0 }));
  }

  if (payload.is_active !== undefined) {
    const isActive = normalizeBooleanFlag(payload.is_active, 'is_active');

    if (isActive === null) {
      const error = new Error('is_active must be a boolean value.');
      error.statusCode = 400;
      throw error;
    }

    updates.push('is_active = ?');
    params.push(isActive);
  }

  if (!updates.length) {
    return getDamageReasonOptionById(pool, optionId, branchId);
  }

  params.push(optionId, branchId);

  await pool.query(
    `UPDATE ${DAMAGE_REASON_OPTIONS_TABLE}
     SET ${updates.join(', ')}
     WHERE id = ?
       AND branch_id = ?`,
    params,
  );

  return getDamageReasonOptionById(pool, optionId, branchId);
}

async function deleteDamageReasonOption(id, branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const optionId = normalizeInteger(id, 'option_id', { min: 1 });
  await getDamageReasonOptionById(pool, optionId, branchId);

  await pool.query(
    `DELETE FROM ${DAMAGE_REASON_OPTIONS_TABLE}
     WHERE id = ?
       AND branch_id = ?`,
    [optionId, branchId],
  );
}

async function reorderDamageReasonOptions(orderedIds, branchId) {
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    const error = new Error('ordered_ids must be a non-empty array.');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  await ensureDamageReportTables(pool);

  const ids = orderedIds.map((value, index) => normalizeInteger(value, `ordered_ids[${index}]`, { min: 1 }));

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (let index = 0; index < ids.length; index += 1) {
      await connection.query(
        `UPDATE ${DAMAGE_REASON_OPTIONS_TABLE}
         SET sort_order = ?
         WHERE id = ?
           AND branch_id = ?`,
        [index + 1, ids[index], branchId],
      );
    }

    await connection.commit();
  } catch (reorderError) {
    await connection.rollback();
    throw reorderError;
  } finally {
    connection.release();
  }

  return listAllDamageReasonOptions(branchId);
}

async function listDamageReports({ branchId, status, search, dateFrom, dateTo } = {}) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const normalizedStatus = normalizeText(status);
  const normalizedSearch = normalizeText(search);
  const normalizedDateFrom = normalizeDateFilter(dateFrom, 'date_from');
  const normalizedDateTo = normalizeDateFilter(dateTo, 'date_to');

  if (normalizedDateFrom && normalizedDateTo && normalizedDateFrom > normalizedDateTo) {
    const error = new Error('date_from cannot be later than date_to.');
    error.statusCode = 400;
    throw error;
  }

  const conditions = ['dr.branch_id = ?'];
  const params = [branchId];

  if (normalizedStatus) {
    conditions.push('dr.status = ?');
    params.push(normalizedStatus);
  }

  if (normalizedSearch) {
    conditions.push('(dr.report_number LIKE ? OR dr.created_by_username LIKE ? OR dr.synced_by_username LIKE ?)');
    const pattern = `%${normalizedSearch}%`;
    params.push(pattern, pattern, pattern);
  }

  if (normalizedDateFrom) {
    conditions.push('DATE(dr.created_at) >= ?');
    params.push(normalizedDateFrom);
  }

  if (normalizedDateTo) {
    conditions.push('DATE(dr.created_at) <= ?');
    params.push(normalizedDateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT dr.id,
            dr.report_number,
            dr.status,
            dr.remarks,
            dr.created_by_user_id,
            dr.created_by_username,
            dr.created_at,
            dr.synced_by_user_id,
            dr.synced_by_username,
            dr.synced_at,
            COUNT(dri.id) AS item_count
     FROM ${DAMAGE_REPORTS_TABLE} dr
     LEFT JOIN ${DAMAGE_REPORT_ITEMS_TABLE} dri ON dri.damage_report_id = dr.id
     ${whereClause}
     GROUP BY dr.id, dr.report_number, dr.status, dr.remarks,
              dr.created_by_user_id, dr.created_by_username, dr.created_at,
              dr.synced_by_user_id, dr.synced_by_username, dr.synced_at
     ORDER BY dr.created_at DESC, dr.id DESC`,
    params,
  );

  return rows.map(mapReportRow);
}

async function getDamageReportItems(connection, reportId) {
  const [rows] = await connection.query(
    `SELECT id, damage_report_id, product_id, product_name, sku, product_barcode,
            qty_damaged, damage_reason, remarks, sort_order, created_at, updated_at
     FROM ${DAMAGE_REPORT_ITEMS_TABLE}
     WHERE damage_report_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [reportId],
  );

  return rows.map(mapItemRow);
}

async function getDamageReport(reportId, branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const id = normalizeInteger(reportId, 'report_id', { min: 1 });
  const report = await getReportById(pool, id, { branchId });

  if (!report) {
    const error = new Error('Damage report not found.');
    error.statusCode = 404;
    throw error;
  }

  const items = await getDamageReportItems(pool, id);

  return {
    ...mapReportRow({ ...report, item_count: items.length }),
    items,
  };
}

async function createDamageReport(sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureDamageReportTables(connection);
    await connection.beginTransaction();

    const reportNumber = await buildDraftReportNumber(connection, branchId);

    const [result] = await connection.query(
      `INSERT INTO ${DAMAGE_REPORTS_TABLE}
        (report_number, status, created_by_user_id, created_by_username, branch_id)
       VALUES (?, 'draft', ?, ?, ?)`,
      [reportNumber, identity.userId, identity.username, branchId],
    );

    await connection.commit();

    return getDamageReport(result.insertId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateDamageReport(reportId, payload = {}, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const id = normalizeInteger(reportId, 'report_id', { min: 1 });

  try {
    await ensureDamageReportTables(connection);
    await connection.beginTransaction();
    await assertDraftReport(connection, id, branchId);

    const remarks = payload.remarks !== undefined ? normalizeText(payload.remarks) : undefined;

    if (remarks !== undefined) {
      await connection.query(
        `UPDATE ${DAMAGE_REPORTS_TABLE} SET remarks = ? WHERE id = ? AND branch_id = ?`,
        [remarks, id, branchId],
      );
    }

    await connection.commit();
    return getDamageReport(id, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteDamageReport(reportId, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const id = normalizeInteger(reportId, 'report_id', { min: 1 });

  try {
    await ensureDamageReportTables(connection);
    await connection.beginTransaction();
    await assertDraftReport(connection, id, branchId);

    await connection.query(`DELETE FROM ${DAMAGE_REPORTS_TABLE} WHERE id = ? AND branch_id = ?`, [id, branchId]);
    await connection.commit();

    return { deleted: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getNextSortOrder(connection, reportId) {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
     FROM ${DAMAGE_REPORT_ITEMS_TABLE}
     WHERE damage_report_id = ?`,
    [reportId],
  );

  return Number(rows[0]?.max_sort || 0) + 1;
}

async function addDamageReportItem(reportId, payload = {}, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const id = normalizeInteger(reportId, 'report_id', { min: 1 });

  try {
    await ensureDamageReportTables(connection);
    await connection.beginTransaction();
    await assertDraftReport(connection, id, branchId);

    const lookup = normalizeText(payload.lookup) || normalizeText(payload.product_barcode);
    const product = await getProductByLookup(connection, lookup, branchId);
    const qtyDamaged = normalizeInteger(payload.qty_damaged, 'qty_damaged', { min: 1 });
    const damageReason = normalizeText(payload.damage_reason);

    if (!damageReason) {
      const error = new Error('damage_reason is required.');
      error.statusCode = 400;
      throw error;
    }

    const remarks = normalizeText(payload.remarks);
    const sortOrder = await getNextSortOrder(connection, id);

    const [result] = await connection.query(
      `INSERT INTO ${DAMAGE_REPORT_ITEMS_TABLE}
        (damage_report_id, product_id, product_name, sku, product_barcode,
         qty_damaged, damage_reason, remarks, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        product.product_id,
        product.product_name,
        product.sku,
        product.product_barcode,
        qtyDamaged,
        damageReason,
        remarks,
        sortOrder,
      ],
    );

    await connection.commit();

    const report = await getDamageReport(id, branchId);
    const item = report.items.find((row) => row.id === result.insertId);
    return item;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateDamageReportItem(reportId, itemId, payload = {}, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const reportIdValue = normalizeInteger(reportId, 'report_id', { min: 1 });
  const itemIdValue = normalizeInteger(itemId, 'item_id', { min: 1 });

  try {
    await ensureDamageReportTables(connection);
    await connection.beginTransaction();
    await assertDraftReport(connection, reportIdValue, branchId);

    const [existingRows] = await connection.query(
      `SELECT id FROM ${DAMAGE_REPORT_ITEMS_TABLE}
       WHERE id = ? AND damage_report_id = ?`,
      [itemIdValue, reportIdValue],
    );

    if (!existingRows.length) {
      const error = new Error('Damage report item not found.');
      error.statusCode = 404;
      throw error;
    }

    const updates = [];
    const params = [];

    if (payload.lookup !== undefined || payload.product_barcode !== undefined) {
      const lookup = normalizeText(payload.lookup) || normalizeText(payload.product_barcode);
      const product = await getProductByLookup(connection, lookup, branchId);
      updates.push('product_id = ?', 'product_name = ?', 'sku = ?', 'product_barcode = ?');
      params.push(product.product_id, product.product_name, product.sku, product.product_barcode);
    }

    if (payload.qty_damaged !== undefined) {
      const qtyDamaged = normalizeInteger(payload.qty_damaged, 'qty_damaged', { min: 1 });
      updates.push('qty_damaged = ?');
      params.push(qtyDamaged);
    }

    if (payload.damage_reason !== undefined) {
      const damageReason = normalizeText(payload.damage_reason);
      if (!damageReason) {
        const error = new Error('damage_reason is required.');
        error.statusCode = 400;
        throw error;
      }
      updates.push('damage_reason = ?');
      params.push(damageReason);
    }

    if (payload.remarks !== undefined) {
      updates.push('remarks = ?');
      params.push(normalizeText(payload.remarks));
    }

    if (!updates.length) {
      const error = new Error('No fields provided to update.');
      error.statusCode = 400;
      throw error;
    }

    params.push(itemIdValue, reportIdValue);

    await connection.query(
      `UPDATE ${DAMAGE_REPORT_ITEMS_TABLE}
       SET ${updates.join(', ')}
       WHERE id = ? AND damage_report_id = ?`,
      params,
    );

    await connection.commit();

    const report = await getDamageReport(reportIdValue, branchId);
    return report.items.find((row) => row.id === itemIdValue);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteDamageReportItem(reportId, itemId, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const reportIdValue = normalizeInteger(reportId, 'report_id', { min: 1 });
  const itemIdValue = normalizeInteger(itemId, 'item_id', { min: 1 });

  try {
    await ensureDamageReportTables(connection);
    await connection.beginTransaction();
    await assertDraftReport(connection, reportIdValue, branchId);

    const [result] = await connection.query(
      `DELETE FROM ${DAMAGE_REPORT_ITEMS_TABLE}
       WHERE id = ? AND damage_report_id = ?`,
      [itemIdValue, reportIdValue],
    );

    if (!result.affectedRows) {
      const error = new Error('Damage report item not found.');
      error.statusCode = 404;
      throw error;
    }

    await connection.commit();
    return { deleted: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function searchDamageReportProducts(query, branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const normalized = normalizeText(query);

  if (!normalized) {
    return [];
  }

  const pattern = `%${normalized}%`;

  const [rows] = await pool.query(
    `SELECT p.product_id,
            p.product_barcode,
            p.product_name,
            COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS available_qty
     FROM products p
     LEFT JOIN product_batches pb
       ON pb.product_barcode = p.product_barcode
      AND pb.branch_id = p.branch_id
      AND COALESCE(pb.Block, 0) = 0
     WHERE p.branch_id = ?
       AND (p.product_barcode = ?
        OR p.product_barcode LIKE CONCAT(?, '%')
        OR p.product_name LIKE ?)
     GROUP BY p.product_id, p.product_barcode, p.product_name
     ORDER BY
       CASE WHEN p.product_barcode = ? THEN 0
            WHEN p.product_barcode LIKE CONCAT(?, '%') THEN 1
            ELSE 2 END,
       p.product_name ASC
     LIMIT 25`,
    [branchId, normalized, normalized, pattern, normalized, normalized],
  );

  return rows.map((row) => ({
    product_id: row.product_id,
    product_barcode: row.product_barcode,
    product_name: row.product_name,
    sku: row.product_barcode,
    available_qty: Number(row.available_qty || 0),
  }));
}

async function getDamageReportSyncPreview(reportId, branchId) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const id = normalizeInteger(reportId, 'report_id', { min: 1 });
  const report = await getReportById(pool, id, { branchId });

  if (!report) {
    const error = new Error('Damage report not found.');
    error.statusCode = 404;
    throw error;
  }

  if (report.status !== 'draft') {
    const error = new Error('Only draft damage reports can be previewed for sync.');
    error.statusCode = 409;
    throw error;
  }

  const items = await getDamageReportItems(pool, id);

  if (!items.length) {
    const error = new Error('Add at least one item before syncing.');
    error.statusCode = 400;
    throw error;
  }

  const lines = [];

  for (const item of items) {
    lines.push(await buildLinePreview(pool, item, branchId));
  }

  const canSync = lines.every((line) => line.can_sync);

  return {
    report_id: id,
    report_number: report.report_number,
    lines,
    can_sync: canSync,
    warnings: lines
      .filter((line) => line.insufficient)
      .map((line) => ({
        product_barcode: line.product_barcode,
        product_name: line.product_name,
        message: `Insufficient stock. Available ${line.total_available}, requested ${line.qty_damaged}, shortfall ${line.shortfall}.`,
      })),
  };
}

async function insertFailedSyncLog(connection, {
  reportId,
  reportNumber,
  syncBatchId,
  identity,
  errorSummary,
  warnings,
  branchId,
}) {
  const [logResult] = await connection.query(
    `INSERT INTO ${DAMAGE_SYNC_LOGS_TABLE}
      (damage_report_id, report_number, sync_batch_id, synced_by_user_id, synced_by_username, status, error_summary, warnings_json, branch_id)
     VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, ?)`,
    [
      reportId,
      reportNumber,
      syncBatchId,
      identity.userId,
      identity.username,
      errorSummary,
      warnings?.length ? JSON.stringify(warnings) : null,
      branchId,
    ],
  );

  return logResult.insertId;
}

async function syncDamageReport(reportId, sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const id = normalizeInteger(reportId, 'report_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);
  const syncBatchId = randomUUID();

  try {
    await ensureDamageReportTables(connection);
    await connection.beginTransaction();

    const report = await assertDraftReport(connection, id, branchId);
    const items = await getDamageReportItems(connection, id);

    if (!items.length) {
      const error = new Error('Add at least one item before syncing.');
      error.statusCode = 400;
      throw error;
    }

    const previewLines = [];

    for (const item of items) {
      const batches = await fetchLofoBatches(connection, item.product_barcode, branchId, { forUpdate: true });
      const allocation = allocateLofoFromBatches(batches, Number(item.qty_damaged || 0));
      previewLines.push({
        item,
        allocation,
      });

      if (allocation.insufficient) {
        const warnings = previewLines
          .filter((line) => line.allocation.insufficient)
          .map((line) => ({
            product_barcode: line.item.product_barcode,
            product_name: line.item.product_name,
            message: `Insufficient stock for ${line.item.product_name}. Available ${line.allocation.total_available}, requested ${line.item.qty_damaged}.`,
          }));

        await connection.rollback();

        const failedLogConnection = await pool.getConnection();
        try {
          await ensureDamageReportTables(failedLogConnection);
          await insertFailedSyncLog(failedLogConnection, {
            reportId: id,
            reportNumber: report.report_number,
            syncBatchId,
            identity,
            errorSummary: 'Sync failed due to insufficient stock in one or more batches.',
            warnings,
            branchId,
          });
        } finally {
          failedLogConnection.release();
        }

        const error = new Error('Sync failed due to insufficient stock. No inventory changes were updated.');
        error.statusCode = 409;
        error.details = { warnings, sync_batch_id: syncBatchId };
        throw error;
      }
    }

    const finalReportNumber = await buildFinalReportNumber(connection, branchId);

    for (const line of previewLines) {
      for (const batchAllocation of line.allocation.allocations) {
        await connection.query(
          `UPDATE product_batches
           SET Qty = ?,
               quantity_remaining = GREATEST(0, COALESCE(quantity_remaining, 0) - ?)
           WHERE id = ?
             AND branch_id = ?`,
          [
            batchAllocation.qty_after,
            batchAllocation.qty_deducted,
            batchAllocation.product_batch_id,
            branchId,
          ],
        );
      }
    }

    await connection.query(
      `UPDATE ${DAMAGE_REPORTS_TABLE}
       SET report_number = ?,
           status = 'synced',
           synced_by_user_id = ?,
           synced_by_username = ?,
           synced_at = NOW()
       WHERE id = ?
         AND branch_id = ?`,
      [finalReportNumber, identity.userId, identity.username, id, branchId],
    );

    const [logResult] = await connection.query(
      `INSERT INTO ${DAMAGE_SYNC_LOGS_TABLE}
        (damage_report_id, report_number, sync_batch_id, synced_by_user_id, synced_by_username, status, branch_id)
       VALUES (?, ?, ?, ?, ?, 'success', ?)`,
      [id, finalReportNumber, syncBatchId, identity.userId, identity.username, branchId],
    );

    const syncLogId = logResult.insertId;

    for (const line of previewLines) {
      const [itemLogResult] = await connection.query(
        `INSERT INTO ${DAMAGE_SYNC_LOG_ITEMS_TABLE}
          (sync_log_id, damage_report_item_id, product_name, sku, product_barcode,
           qty_requested, qty_deducted, damage_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          syncLogId,
          line.item.id,
          line.item.product_name,
          line.item.sku,
          line.item.product_barcode,
          line.item.qty_damaged,
          line.allocation.qty_deducted,
          line.item.damage_reason,
        ],
      );

      const syncLogItemId = itemLogResult.insertId;

      for (const batchAllocation of line.allocation.allocations) {
        await connection.query(
          `INSERT INTO ${DAMAGE_SYNC_LOG_BATCHES_TABLE}
            (sync_log_item_id, product_batch_id, batch_id, cost_price, qty_before, qty_deducted, qty_after)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            syncLogItemId,
            batchAllocation.product_batch_id,
            batchAllocation.batch_id,
            batchAllocation.cost_price,
            batchAllocation.qty_before,
            batchAllocation.qty_deducted,
            batchAllocation.qty_after,
          ],
        );
      }
    }

    await connection.commit();

    return {
      report_id: id,
      report_number: finalReportNumber,
      sync_batch_id: syncBatchId,
      sync_log_id: syncLogId,
      status: 'success',
      items_synced: previewLines.length,
    };
  } catch (error) {
    await connection.rollback();

    if (error.statusCode === 409 && error.details) {
      throw error;
    }

    throw error;
  } finally {
    connection.release();
  }
}

function mapSyncLogHeader(row) {
  return {
    id: row.id,
    damage_report_id: row.damage_report_id,
    report_number: row.report_number,
    sync_batch_id: row.sync_batch_id,
    synced_by_user_id: row.synced_by_user_id,
    synced_by_username: row.synced_by_username,
    synced_at: row.synced_at,
    status: row.status,
    error_summary: row.error_summary,
    warnings_json: row.warnings_json,
  };
}

async function getSyncLogDetail(connection, syncLogId) {
  const [logRows] = await connection.query(
    `SELECT id, damage_report_id, report_number, sync_batch_id,
            synced_by_user_id, synced_by_username, synced_at, status, error_summary, warnings_json
     FROM ${DAMAGE_SYNC_LOGS_TABLE}
     WHERE id = ?`,
    [syncLogId],
  );

  if (!logRows.length) {
    return null;
  }

  const log = mapSyncLogHeader(logRows[0]);

  const [itemRows] = await connection.query(
    `SELECT id, sync_log_id, damage_report_item_id, product_name, sku, product_barcode,
            qty_requested, qty_deducted, damage_reason
     FROM ${DAMAGE_SYNC_LOG_ITEMS_TABLE}
     WHERE sync_log_id = ?
     ORDER BY id ASC`,
    [syncLogId],
  );

  const items = [];

  for (const itemRow of itemRows) {
    const [batchRows] = await connection.query(
      `SELECT id, sync_log_item_id, product_batch_id, batch_id, cost_price,
              qty_before, qty_deducted, qty_after
       FROM ${DAMAGE_SYNC_LOG_BATCHES_TABLE}
       WHERE sync_log_item_id = ?
       ORDER BY id ASC`,
      [itemRow.id],
    );

    items.push({
      ...itemRow,
      batches: batchRows,
    });
  }

  return {
    ...log,
    items,
    warnings: log.warnings_json ? JSON.parse(log.warnings_json) : [],
  };
}

async function listDamageReportSyncLogs({
  branchId,
  reportId,
  startDate,
  endDate,
  username,
  reportNumber,
  search,
  limit,
} = {}) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const normalizedStartDate = normalizeDateFilter(startDate, 'start_date');
  const normalizedEndDate = normalizeDateFilter(endDate, 'end_date');
  const normalizedUsername = normalizeText(username);
  const normalizedReportNumber = normalizeText(reportNumber);
  const normalizedSearch = normalizeText(search);
  const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.min(Number(limit), 500)
    : 200;

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    const error = new Error('start_date cannot be later than end_date.');
    error.statusCode = 400;
    throw error;
  }

  const conditions = ['dsl.branch_id = ?'];
  const params = [branchId];

  if (reportId) {
    conditions.push('dsl.damage_report_id = ?');
    params.push(normalizeInteger(reportId, 'report_id', { min: 1 }));
  }

  if (normalizedStartDate) {
    conditions.push('DATE(dsl.synced_at) >= ?');
    params.push(normalizedStartDate);
  }

  if (normalizedEndDate) {
    conditions.push('DATE(dsl.synced_at) <= ?');
    params.push(normalizedEndDate);
  }

  if (normalizedUsername) {
    conditions.push('dsl.synced_by_username = ?');
    params.push(normalizedUsername);
  }

  if (normalizedReportNumber) {
    conditions.push('dsl.report_number LIKE ?');
    params.push(`%${normalizedReportNumber}%`);
  }

  if (normalizedSearch) {
    conditions.push('(dsl.report_number LIKE ? OR dsl.synced_by_username LIKE ? OR dsl.error_summary LIKE ?)');
    const pattern = `%${normalizedSearch}%`;
    params.push(pattern, pattern, pattern);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT dsl.id,
            dsl.damage_report_id,
            dsl.report_number,
            dsl.sync_batch_id,
            dsl.synced_by_user_id,
            dsl.synced_by_username,
            dsl.synced_at,
            dsl.status,
            dsl.error_summary,
            dsl.warnings_json
     FROM ${DAMAGE_SYNC_LOGS_TABLE} dsl
     ${whereClause}
     ORDER BY dsl.synced_at DESC, dsl.id DESC
     LIMIT ?`,
    [...params, normalizedLimit],
  );

  const logs = [];

  for (const row of rows) {
    logs.push(await getSyncLogDetail(pool, row.id));
  }

  const usernames = [...new Set(logs.map((log) => log?.synced_by_username).filter(Boolean))];

  return {
    data: logs.filter(Boolean),
    filters: {
      start_date: normalizedStartDate,
      end_date: normalizedEndDate,
      username: normalizedUsername,
      report_number: normalizedReportNumber,
      search: normalizedSearch,
      limit: normalizedLimit,
    },
    usernames,
  };
}

async function listSyncLogsForReport(reportId, branchId) {
  return listDamageReportSyncLogs({ branchId, reportId, limit: 50 });
}

module.exports = {
  ensureDamageReportTables,
  listDamageReasonOptions,
  listAllDamageReasonOptions,
  createDamageReasonOption,
  updateDamageReasonOption,
  deleteDamageReasonOption,
  reorderDamageReasonOptions,
  listDamageReports,
  getDamageReport,
  createDamageReport,
  updateDamageReport,
  deleteDamageReport,
  addDamageReportItem,
  updateDamageReportItem,
  deleteDamageReportItem,
  listDamageReportProducts,
  lookupDamageReportProductByBarcode,
  searchDamageReportProducts,
  getDamageReportSyncPreview,
  syncDamageReport,
  listDamageReportSyncLogs,
  listSyncLogsForReport,
};
