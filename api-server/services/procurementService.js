const { getPool } = require('../db');

const SUPPLIERS_TABLE = 'suppliers';
const PR_TABLE = 'purchase_requisitions';
const PR_ITEMS_TABLE = 'purchase_requisition_items';
const PO_TABLE = 'purchase_orders';
// Legacy DBs may already have purchase_order_items (po_item_id/po_id). Use a distinct table name.
const PO_ITEMS_TABLE = 'purchase_order_lines';
const RR_TABLE = 'receiving_reports';
const RR_ITEMS_TABLE = 'receiving_report_items';
const SI_TABLE = 'supplier_invoices';
const SI_ITEMS_TABLE = 'supplier_invoice_items';
const MATCH_TABLE = 'procurement_match_reviews';
const AP_TABLE = 'accounts_payable_payments';

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

function normalizeDecimal(value, fieldName, { min = 0 } = {}) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(`${fieldName} is required.`);
    error.statusCode = 400;
    throw error;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    const error = new Error(`${fieldName} must be a valid number equal to or greater than ${min}.`);
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

function normalizeOptionalDate(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return normalizeDateFilter(value, fieldName);
}

function getSessionIdentity(sessionUser) {
  return {
    userId: normalizeText(sessionUser?.userId),
    username: normalizeText(sessionUser?.username) || normalizeText(sessionUser?.fullName),
    role: normalizeText(sessionUser?.role),
  };
}

function isApprover(sessionUser) {
  const role = normalizeText(sessionUser?.role);
  return role === 'Admin' || role === 'Manager';
}

function assertApprover(sessionUser) {
  if (!isApprover(sessionUser)) {
    const error = new Error('Only Admin or Manager can perform this action.');
    error.statusCode = 403;
    throw error;
  }
}

function requireReason(value, fieldName = 'reason') {
  const text = normalizeText(value);
  if (!text) {
    const error = new Error(`${fieldName} is required.`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

async function buildDocumentNumber(connection, prefix, tableName, columnName, branchId) {
  const year = new Date().getFullYear();
  const docPrefix = `${prefix}-${year}-`;
  const startPos = docPrefix.length + 1;

  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${columnName}, ?) AS UNSIGNED)), 0) AS max_sequence
     FROM ${tableName}
     WHERE ${columnName} LIKE ?
       AND branch_id = ?`,
    [startPos, `${docPrefix}%`, branchId],
  );

  const nextSequence = Number(rows[0]?.max_sequence || 0) + 1;
  return `${docPrefix}${String(nextSequence).padStart(3, '0')}`;
}

async function buildBatchId(connection, inputBatchId, productBarcode, branchId) {
  const normalizedBatchId = normalizeText(inputBatchId);
  if (normalizedBatchId) {
    return normalizedBatchId;
  }

  const normalizedBarcode = normalizeText(productBarcode);
  if (!normalizedBarcode) {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `TMP-${timestamp}`;
  }

  const [rows] = await connection.query(
    `SELECT COUNT(DISTINCT batch_id) AS batchCount
     FROM product_batches
     WHERE product_barcode = ?
       AND branch_id = ?
       AND batch_id IS NOT NULL
       AND TRIM(batch_id) <> ''`,
    [normalizedBarcode, branchId],
  );

  const count = Number(rows[0]?.batchCount || 0);
  return `B-${String(count + 1).padStart(3, '0')}`;
}

async function ensureProcurementTables(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${SUPPLIERS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      supplier_name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255) DEFAULT NULL,
      contact_phone VARCHAR(100) DEFAULT NULL,
      contact_email VARCHAR(255) DEFAULT NULL,
      payment_terms VARCHAR(100) DEFAULT 'Net 30',
      address TEXT DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_suppliers_active (is_active),
      KEY idx_suppliers_name (supplier_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${PR_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      pr_number VARCHAR(30) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      preferred_supplier_id INT DEFAULT NULL,
      remarks TEXT DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      created_by_user_id VARCHAR(45) DEFAULT NULL,
      created_by_username VARCHAR(255) DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      approved_by_user_id VARCHAR(45) DEFAULT NULL,
      approved_by_username VARCHAR(255) DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      rejected_by_user_id VARCHAR(45) DEFAULT NULL,
      rejected_by_username VARCHAR(255) DEFAULT NULL,
      rejected_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pr_number (pr_number),
      KEY idx_pr_status (status),
      KEY idx_pr_created_at (created_at),
      KEY idx_pr_supplier (preferred_supplier_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${PR_ITEMS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      purchase_requisition_id INT NOT NULL,
      product_id INT DEFAULT NULL,
      product_name VARCHAR(500) NOT NULL,
      sku VARCHAR(100) NOT NULL,
      product_barcode VARCHAR(100) NOT NULL,
      qty_requested INT NOT NULL,
      unit_snapshot VARCHAR(50) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pr_items_pr (purchase_requisition_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${PO_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      po_number VARCHAR(30) NOT NULL,
      purchase_requisition_id INT NOT NULL,
      supplier_id INT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      expected_delivery_date DATE DEFAULT NULL,
      cancel_reason TEXT DEFAULT NULL,
      created_by_user_id VARCHAR(45) DEFAULT NULL,
      created_by_username VARCHAR(255) DEFAULT NULL,
      sent_by_user_id VARCHAR(45) DEFAULT NULL,
      sent_by_username VARCHAR(255) DEFAULT NULL,
      sent_at DATETIME DEFAULT NULL,
      cancelled_by_user_id VARCHAR(45) DEFAULT NULL,
      cancelled_by_username VARCHAR(255) DEFAULT NULL,
      cancelled_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_po_number (po_number),
      KEY idx_po_status (status),
      KEY idx_po_pr (purchase_requisition_id),
      KEY idx_po_supplier (supplier_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${PO_ITEMS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      purchase_order_id INT NOT NULL,
      purchase_requisition_item_id INT DEFAULT NULL,
      product_id INT DEFAULT NULL,
      product_name VARCHAR(500) NOT NULL,
      sku VARCHAR(100) NOT NULL,
      product_barcode VARCHAR(100) NOT NULL,
      qty_ordered INT NOT NULL,
      qty_received INT NOT NULL DEFAULT 0,
      unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_po_items_po (purchase_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${RR_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      rr_number VARCHAR(30) NOT NULL,
      purchase_order_id INT NOT NULL,
      supplier_dr_number VARCHAR(100) DEFAULT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      remarks TEXT DEFAULT NULL,
      created_by_user_id VARCHAR(45) DEFAULT NULL,
      created_by_username VARCHAR(255) DEFAULT NULL,
      received_by_user_id VARCHAR(45) DEFAULT NULL,
      received_by_username VARCHAR(255) DEFAULT NULL,
      received_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_rr_number (rr_number),
      KEY idx_rr_po (purchase_order_id),
      KEY idx_rr_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${RR_ITEMS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      receiving_report_id INT NOT NULL,
      purchase_order_item_id INT NOT NULL,
      product_name VARCHAR(500) NOT NULL,
      sku VARCHAR(100) NOT NULL,
      product_barcode VARCHAR(100) NOT NULL,
      qty_received INT NOT NULL,
      item_condition VARCHAR(20) NOT NULL DEFAULT 'good',
      expiry_date DATE DEFAULT NULL,
      batch_number VARCHAR(100) DEFAULT NULL,
      unit_cost_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_rr_items_rr (receiving_report_id),
      KEY idx_rr_items_po_item (purchase_order_item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${SI_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      purchase_order_id INT NOT NULL,
      invoice_number VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      invoice_date DATE DEFAULT NULL,
      amount_total DECIMAL(14,2) NOT NULL DEFAULT 0,
      payment_terms VARCHAR(100) DEFAULT NULL,
      created_by_user_id VARCHAR(45) DEFAULT NULL,
      created_by_username VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_si_po (purchase_order_id),
      KEY idx_si_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${SI_ITEMS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      supplier_invoice_id INT NOT NULL,
      purchase_order_item_id INT DEFAULT NULL,
      product_name VARCHAR(500) NOT NULL,
      sku VARCHAR(100) NOT NULL,
      product_barcode VARCHAR(100) NOT NULL,
      qty_invoiced INT NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_si_items_invoice (supplier_invoice_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${MATCH_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      purchase_order_id INT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'needs_review',
      discrepancy_json TEXT DEFAULT NULL,
      reviewed_by_user_id VARCHAR(45) DEFAULT NULL,
      reviewed_by_username VARCHAR(255) DEFAULT NULL,
      reviewed_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_match_po (purchase_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${AP_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      purchase_order_id INT NOT NULL,
      supplier_invoice_id INT DEFAULT NULL,
      supplier_id INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
      amount_due DECIMAL(14,2) NOT NULL DEFAULT 0,
      amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
      payment_terms VARCHAR(100) DEFAULT NULL,
      payment_date DATE DEFAULT NULL,
      payment_method VARCHAR(50) DEFAULT NULL,
      paid_by_user_id VARCHAR(45) DEFAULT NULL,
      paid_by_username VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ap_po (purchase_order_id),
      KEY idx_ap_status (status),
      KEY idx_ap_supplier (supplier_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );
}

async function getProductByLookup(connection, lookup, branchId) {
  const normalized = normalizeText(lookup);
  if (!normalized) {
    const error = new Error('Product lookup value is required.');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await connection.query(
    `SELECT p.product_id, p.product_barcode, p.product_name, p.unit, COALESCE(p.rop, 0) AS rop
     FROM products p
     WHERE p.branch_id = ?
       AND (p.product_barcode = ?
        OR p.product_barcode LIKE CONCAT(?, '%')
        OR p.product_name LIKE CONCAT('%', ?, '%'))
     ORDER BY CASE WHEN p.product_barcode = ? THEN 0 ELSE 1 END, p.product_name ASC
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
    unit: row.unit,
    rop: Number(row.rop || 0),
  };
}

async function getSupplierById(connection, supplierId, { forUpdate = false, branchId } = {}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(
    `SELECT id, supplier_name, contact_person, contact_phone, contact_email,
            payment_terms, address, is_active, created_at, updated_at
     FROM ${SUPPLIERS_TABLE} WHERE id = ? AND branch_id = ?${lockClause}`,
    [supplierId, branchId],
  );
  return rows[0] || null;
}

function mapSupplierRow(row) {
  return {
    id: row.id,
    supplier_name: row.supplier_name,
    contact_person: row.contact_person,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    payment_terms: row.payment_terms,
    address: row.address,
    is_active: Number(row.is_active ?? 1),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listReorderAlerts(branchId) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const [rows] = await pool.query(
    `SELECT p.product_name,
            p.product_barcode AS sku,
            p.product_barcode AS barcode,
            COALESCE(stock.total_qty, 0) AS current_stock,
            COALESCE(p.rop, 0) AS rop,
            GREATEST(COALESCE(p.rop, 0) - COALESCE(stock.total_qty, 0), 1) AS suggested_order_qty
     FROM products p
     LEFT JOIN (
       SELECT pb.product_barcode, COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS total_qty
       FROM product_batches pb
       WHERE COALESCE(pb.Block, 0) = 0
         AND pb.branch_id = ?
       GROUP BY pb.product_barcode
     ) stock ON stock.product_barcode = p.product_barcode
     WHERE p.branch_id = ?
       AND COALESCE(stock.total_qty, 0) <= COALESCE(p.rop, 0)
       AND p.product_barcode IS NOT NULL
       AND TRIM(p.product_barcode) <> ''
     ORDER BY p.product_name ASC`,
    [branchId, branchId],
  );

  return rows.map((row) => ({
    product_name: row.product_name,
    sku: row.sku,
    barcode: row.barcode,
    current_stock: Number(row.current_stock || 0),
    rop: Number(row.rop || 0),
    suggested_order_qty: Number(row.suggested_order_qty || 1),
  }));
}

async function listSuppliers({ branchId, activeOnly = true, search } = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const conditions = ['branch_id = ?'];
  const params = [branchId];

  if (activeOnly) {
    conditions.push('is_active = 1');
  }

  const normalizedSearch = normalizeText(search);
  if (normalizedSearch) {
    conditions.push('(supplier_name LIKE ? OR contact_person LIKE ? OR contact_email LIKE ?)');
    const pattern = `%${normalizedSearch}%`;
    params.push(pattern, pattern, pattern);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT id, supplier_name, contact_person, contact_phone, contact_email,
            payment_terms, address, is_active, created_at, updated_at
     FROM ${SUPPLIERS_TABLE}
     ${whereClause}
     ORDER BY supplier_name ASC`,
    params,
  );

  return rows.map(mapSupplierRow);
}

async function createSupplier(payload = {}, branchId) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const supplierName = normalizeText(payload.supplier_name);
  if (!supplierName) {
    const error = new Error('supplier_name is required.');
    error.statusCode = 400;
    throw error;
  }

  const [result] = await pool.query(
    `INSERT INTO ${SUPPLIERS_TABLE}
      (supplier_name, contact_person, contact_phone, contact_email, payment_terms, address, is_active, branch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      supplierName,
      normalizeText(payload.contact_person),
      normalizeText(payload.contact_phone),
      normalizeText(payload.contact_email),
      normalizeText(payload.payment_terms) || 'Net 30',
      normalizeText(payload.address),
      payload.is_active === undefined || payload.is_active === null ? 1 : (payload.is_active ? 1 : 0),
      branchId,
    ],
  );

  const supplier = await getSupplierById(pool, result.insertId, { branchId });
  return mapSupplierRow(supplier);
}

async function updateSupplier(id, payload = {}, branchId) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const supplierId = normalizeInteger(id, 'supplier_id', { min: 1 });
  const existing = await getSupplierById(pool, supplierId, { branchId });

  if (!existing) {
    const error = new Error('Supplier not found.');
    error.statusCode = 404;
    throw error;
  }

  const updates = [];
  const params = [];

  if (payload.supplier_name !== undefined) {
    const name = normalizeText(payload.supplier_name);
    if (!name) {
      const error = new Error('supplier_name is required.');
      error.statusCode = 400;
      throw error;
    }
    updates.push('supplier_name = ?');
    params.push(name);
  }

  ['contact_person', 'contact_phone', 'contact_email', 'payment_terms', 'address'].forEach((field) => {
    if (payload[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(normalizeText(payload[field]));
    }
  });

  if (payload.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(payload.is_active ? 1 : 0);
  }

  if (!updates.length) {
    return mapSupplierRow(existing);
  }

  params.push(supplierId, branchId);
  await pool.query(`UPDATE ${SUPPLIERS_TABLE} SET ${updates.join(', ')} WHERE id = ? AND branch_id = ?`, params);

  const updated = await getSupplierById(pool, supplierId, { branchId });
  return mapSupplierRow(updated);
}

function mapPrRow(row) {
  return {
    id: row.id,
    pr_number: row.pr_number,
    status: row.status,
    preferred_supplier_id: row.preferred_supplier_id,
    preferred_supplier_name: row.preferred_supplier_name || null,
    remarks: row.remarks,
    rejection_reason: row.rejection_reason,
    created_by_user_id: row.created_by_user_id,
    created_by_username: row.created_by_username,
    submitted_at: row.submitted_at,
    approved_by_user_id: row.approved_by_user_id,
    approved_by_username: row.approved_by_username,
    approved_at: row.approved_at,
    rejected_by_user_id: row.rejected_by_user_id,
    rejected_by_username: row.rejected_by_username,
    rejected_at: row.rejected_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: Number(row.item_count || 0),
  };
}

function mapPrItemRow(row) {
  return {
    id: row.id,
    purchase_requisition_id: row.purchase_requisition_id,
    product_id: row.product_id,
    product_name: row.product_name,
    sku: row.sku,
    product_barcode: row.product_barcode,
    qty_requested: Number(row.qty_requested || 0),
    unit_snapshot: row.unit_snapshot,
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getPrById(connection, prId, { forUpdate = false, branchId } = {}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(
    `SELECT pr.*, s.supplier_name AS preferred_supplier_name
     FROM ${PR_TABLE} pr
     LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = pr.preferred_supplier_id AND s.branch_id = pr.branch_id
     WHERE pr.id = ?
       AND pr.branch_id = ?${lockClause}`,
    [prId, branchId],
  );
  return rows[0] || null;
}

async function getPrItems(connection, prId) {
  const [rows] = await connection.query(
    `SELECT id, purchase_requisition_id, product_id, product_name, sku, product_barcode,
            qty_requested, unit_snapshot, sort_order, created_at, updated_at
     FROM ${PR_ITEMS_TABLE}
     WHERE purchase_requisition_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [prId],
  );
  return rows.map(mapPrItemRow);
}

async function assertDraftPr(connection, prId, branchId) {
  const pr = await getPrById(connection, prId, { forUpdate: true, branchId });
  if (!pr) {
    const error = new Error('Purchase requisition not found.');
    error.statusCode = 404;
    throw error;
  }
  if (pr.status !== 'draft') {
    const error = new Error('Only draft purchase requisitions can be modified.');
    error.statusCode = 409;
    throw error;
  }
  return pr;
}

async function normalizePrItems(connection, items, branchId) {
  if (!Array.isArray(items) || !items.length) {
    const error = new Error('At least one requisition item is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const lookup = normalizeText(item.lookup) || normalizeText(item.product_barcode);
    const product = await getProductByLookup(connection, lookup, branchId);
    const qtyRequested = normalizeInteger(item.qty_requested, `items[${index}].qty_requested`, { min: 1 });
    normalized.push({
      product_id: product.product_id,
      product_name: product.product_name,
      sku: product.sku,
      product_barcode: product.product_barcode,
      qty_requested: qtyRequested,
      unit_snapshot: normalizeText(item.unit_snapshot) || normalizeText(product.unit),
      sort_order: index + 1,
    });
  }
  return normalized;
}

async function replacePrItems(connection, prId, items) {
  await connection.query(`DELETE FROM ${PR_ITEMS_TABLE} WHERE purchase_requisition_id = ?`, [prId]);
  for (const item of items) {
    await connection.query(
      `INSERT INTO ${PR_ITEMS_TABLE}
        (purchase_requisition_id, product_id, product_name, sku, product_barcode, qty_requested, unit_snapshot, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [prId, item.product_id, item.product_name, item.sku, item.product_barcode, item.qty_requested, item.unit_snapshot, item.sort_order],
    );
  }
}

async function listRequisitions(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const conditions = ['pr.branch_id = ?'];
  const params = [branchId];
  const status = normalizeText(filters.status);
  const search = normalizeText(filters.search);
  const dateFrom = normalizeDateFilter(filters.date_from || filters.dateFrom, 'date_from');
  const dateTo = normalizeDateFilter(filters.date_to || filters.dateTo, 'date_to');

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error('date_from cannot be later than date_to.');
    error.statusCode = 400;
    throw error;
  }

  if (status) {
    conditions.push('pr.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(pr.pr_number LIKE ? OR pr.created_by_username LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }
  if (dateFrom) {
    conditions.push('DATE(pr.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(pr.created_at) <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.status, pr.preferred_supplier_id, s.supplier_name AS preferred_supplier_name,
            pr.remarks, pr.rejection_reason, pr.created_by_user_id, pr.created_by_username,
            pr.submitted_at, pr.approved_by_user_id, pr.approved_by_username, pr.approved_at,
            pr.rejected_by_user_id, pr.rejected_by_username, pr.rejected_at,
            pr.created_at, pr.updated_at, COUNT(pri.id) AS item_count
     FROM ${PR_TABLE} pr
     LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = pr.preferred_supplier_id
     LEFT JOIN ${PR_ITEMS_TABLE} pri ON pri.purchase_requisition_id = pr.id
     ${whereClause}
     GROUP BY pr.id, pr.pr_number, pr.status, pr.preferred_supplier_id, s.supplier_name,
              pr.remarks, pr.rejection_reason, pr.created_by_user_id, pr.created_by_username,
              pr.submitted_at, pr.approved_by_user_id, pr.approved_by_username, pr.approved_at,
              pr.rejected_by_user_id, pr.rejected_by_username, pr.rejected_at, pr.created_at, pr.updated_at
     ORDER BY pr.created_at DESC, pr.id DESC`,
    params,
  );

  return rows.map(mapPrRow);
}

async function getRequisition(id, branchId) {
  const pool = getPool();
  await ensureProcurementTables(pool);
  const prId = normalizeInteger(id, 'requisition_id', { min: 1 });
  const pr = await getPrById(pool, prId, { branchId });
  if (!pr) {
    const error = new Error('Purchase requisition not found.');
    error.statusCode = 404;
    throw error;
  }
  const items = await getPrItems(pool, prId);
  return { ...mapPrRow({ ...pr, item_count: items.length }), items };
}

async function createRequisition(payload = {}, sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const items = await normalizePrItems(connection, payload.items, branchId);
    const prNumber = await buildDocumentNumber(connection, 'PR', PR_TABLE, 'pr_number', branchId);
    const preferredSupplierId = payload.preferred_supplier_id !== undefined && payload.preferred_supplier_id !== null
      ? normalizeInteger(payload.preferred_supplier_id, 'preferred_supplier_id', { min: 1 })
      : null;

    if (preferredSupplierId) {
      const supplier = await getSupplierById(connection, preferredSupplierId, { branchId });
      if (!supplier) {
        const error = new Error('Preferred supplier not found.');
        error.statusCode = 404;
        throw error;
      }
    }

    const [result] = await connection.query(
      `INSERT INTO ${PR_TABLE}
        (pr_number, status, preferred_supplier_id, remarks, created_by_user_id, created_by_username, branch_id)
       VALUES (?, 'draft', ?, ?, ?, ?, ?)`,
      [prNumber, preferredSupplierId, normalizeText(payload.remarks), identity.userId, identity.username, branchId],
    );

    await replacePrItems(connection, result.insertId, items);
    await connection.commit();
    return getRequisition(result.insertId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateRequisition(id, payload = {}, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const prId = normalizeInteger(id, 'requisition_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    await assertDraftPr(connection, prId, branchId);

    if (payload.preferred_supplier_id !== undefined) {
      const supplierId = payload.preferred_supplier_id === null
        ? null
        : normalizeInteger(payload.preferred_supplier_id, 'preferred_supplier_id', { min: 1 });
      if (supplierId) {
        const supplier = await getSupplierById(connection, supplierId, { branchId });
        if (!supplier) {
          const error = new Error('Preferred supplier not found.');
          error.statusCode = 404;
          throw error;
        }
      }
      await connection.query(`UPDATE ${PR_TABLE} SET preferred_supplier_id = ? WHERE id = ? AND branch_id = ?`, [supplierId, prId, branchId]);
    }

    if (payload.remarks !== undefined) {
      await connection.query(`UPDATE ${PR_TABLE} SET remarks = ? WHERE id = ? AND branch_id = ?`, [normalizeText(payload.remarks), prId, branchId]);
    }

    if (payload.items !== undefined) {
      const items = await normalizePrItems(connection, payload.items, branchId);
      await replacePrItems(connection, prId, items);
    }

    await connection.commit();
    return getRequisition(prId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteRequisition(id, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const prId = normalizeInteger(id, 'requisition_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    await assertDraftPr(connection, prId, branchId);
    await connection.query(`DELETE FROM ${PR_ITEMS_TABLE} WHERE purchase_requisition_id = ?`, [prId]);
    await connection.query(`DELETE FROM ${PR_TABLE} WHERE id = ? AND branch_id = ?`, [prId, branchId]);
    await connection.commit();
    return { deleted: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function submitRequisition(id, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const prId = normalizeInteger(id, 'requisition_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    await assertDraftPr(connection, prId, branchId);
    const items = await getPrItems(connection, prId);

    if (!items.length) {
      const error = new Error('Add at least one item before submitting.');
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `UPDATE ${PR_TABLE}
       SET status = 'submitted', submitted_at = NOW(), rejection_reason = NULL,
           rejected_by_user_id = NULL, rejected_by_username = NULL, rejected_at = NULL
       WHERE id = ?
         AND branch_id = ?`,
      [prId, branchId],
    );

    await connection.commit();
    return getRequisition(prId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function approveRequisition(id, sessionUser, branchId) {
  assertApprover(sessionUser);
  const pool = getPool();
  const connection = await pool.getConnection();
  const prId = normalizeInteger(id, 'requisition_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    const pr = await getPrById(connection, prId, { forUpdate: true, branchId });

    if (!pr) {
      const error = new Error('Purchase requisition not found.');
      error.statusCode = 404;
      throw error;
    }
    if (pr.status !== 'submitted') {
      const error = new Error('Only submitted purchase requisitions can be approved.');
      error.statusCode = 409;
      throw error;
    }

    await connection.query(
      `UPDATE ${PR_TABLE}
       SET status = 'approved', approved_by_user_id = ?, approved_by_username = ?, approved_at = NOW(),
           rejection_reason = NULL, rejected_by_user_id = NULL, rejected_by_username = NULL, rejected_at = NULL
       WHERE id = ?
         AND branch_id = ?`,
      [identity.userId, identity.username, prId, branchId],
    );

    await connection.commit();
    return getRequisition(prId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function rejectRequisition(id, payload = {}, sessionUser, branchId) {
  assertApprover(sessionUser);
  const reason = requireReason(payload.reason || payload.rejection_reason, 'rejection_reason');
  const pool = getPool();
  const connection = await pool.getConnection();
  const prId = normalizeInteger(id, 'requisition_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    const pr = await getPrById(connection, prId, { forUpdate: true, branchId });

    if (!pr) {
      const error = new Error('Purchase requisition not found.');
      error.statusCode = 404;
      throw error;
    }
    if (pr.status !== 'submitted') {
      const error = new Error('Only submitted purchase requisitions can be rejected.');
      error.statusCode = 409;
      throw error;
    }

    await connection.query(
      `UPDATE ${PR_TABLE}
       SET status = 'rejected', rejection_reason = ?, rejected_by_user_id = ?, rejected_by_username = ?, rejected_at = NOW()
       WHERE id = ?
         AND branch_id = ?`,
      [reason, identity.userId, identity.username, prId, branchId],
    );

    await connection.commit();
    return getRequisition(prId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function resubmitRequisition(id, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const prId = normalizeInteger(id, 'requisition_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    const pr = await getPrById(connection, prId, { forUpdate: true, branchId });

    if (!pr) {
      const error = new Error('Purchase requisition not found.');
      error.statusCode = 404;
      throw error;
    }
    if (pr.status !== 'rejected') {
      const error = new Error('Only rejected purchase requisitions can be resubmitted.');
      error.statusCode = 409;
      throw error;
    }

    const items = await getPrItems(connection, prId);
    if (!items.length) {
      const error = new Error('Add at least one item before resubmitting.');
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `UPDATE ${PR_TABLE}
       SET status = 'submitted', submitted_at = NOW(), rejection_reason = NULL,
           rejected_by_user_id = NULL, rejected_by_username = NULL, rejected_at = NULL
       WHERE id = ?
         AND branch_id = ?`,
      [prId, branchId],
    );

    await connection.commit();
    return getRequisition(prId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function mapPoRow(row) {
  return {
    id: row.id,
    po_number: row.po_number,
    purchase_requisition_id: row.purchase_requisition_id,
    pr_number: row.pr_number || null,
    supplier_id: row.supplier_id,
    supplier_name: row.supplier_name || null,
    status: row.status,
    expected_delivery_date: row.expected_delivery_date,
    cancel_reason: row.cancel_reason,
    created_by_user_id: row.created_by_user_id,
    created_by_username: row.created_by_username,
    sent_by_user_id: row.sent_by_user_id,
    sent_by_username: row.sent_by_username,
    sent_at: row.sent_at,
    cancelled_by_user_id: row.cancelled_by_user_id,
    cancelled_by_username: row.cancelled_by_username,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: Number(row.item_count || 0),
  };
}

function mapPoItemRow(row) {
  return {
    id: row.id,
    purchase_order_id: row.purchase_order_id,
    purchase_requisition_item_id: row.purchase_requisition_item_id,
    product_id: row.product_id,
    product_name: row.product_name,
    sku: row.sku,
    product_barcode: row.product_barcode,
    qty_ordered: Number(row.qty_ordered || 0),
    qty_received: Number(row.qty_received || 0),
    unit_cost: Number(row.unit_cost || 0),
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getPoById(connection, poId, { forUpdate = false, branchId } = {}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(
    `SELECT po.*, pr.pr_number, s.supplier_name
     FROM ${PO_TABLE} po
     LEFT JOIN ${PR_TABLE} pr ON pr.id = po.purchase_requisition_id AND pr.branch_id = po.branch_id
     LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = po.supplier_id AND s.branch_id = po.branch_id
     WHERE po.id = ?
       AND po.branch_id = ?${lockClause}`,
    [poId, branchId],
  );
  return rows[0] || null;
}

async function getPoItems(connection, poId) {
  const [rows] = await connection.query(
    `SELECT id, purchase_order_id, purchase_requisition_item_id, product_id, product_name, sku,
            product_barcode, qty_ordered, qty_received, unit_cost, sort_order, created_at, updated_at
     FROM ${PO_ITEMS_TABLE} WHERE purchase_order_id = ? ORDER BY sort_order ASC, id ASC`,
    [poId],
  );
  return rows.map(mapPoItemRow);
}

async function assertDraftPo(connection, poId, branchId) {
  const po = await getPoById(connection, poId, { forUpdate: true, branchId });
  if (!po) {
    const error = new Error('Purchase order not found.');
    error.statusCode = 404;
    throw error;
  }
  if (po.status !== 'draft') {
    const error = new Error('Only draft purchase orders can be modified.');
    error.statusCode = 409;
    throw error;
  }
  return po;
}

async function listOrders(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const conditions = ['po.branch_id = ?'];
  const params = [branchId];
  const status = normalizeText(filters.status);
  const search = normalizeText(filters.search);
  const supplierId = filters.supplier_id !== undefined && filters.supplier_id !== null && filters.supplier_id !== ''
    ? normalizeInteger(filters.supplier_id, 'supplier_id', { min: 1 })
    : null;

  if (status) {
    conditions.push('po.status = ?');
    params.push(status);
  }
  if (supplierId) {
    conditions.push('po.supplier_id = ?');
    params.push(supplierId);
  }
  if (search) {
    conditions.push('(po.po_number LIKE ? OR pr.pr_number LIKE ? OR s.supplier_name LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT po.id, po.po_number, po.purchase_requisition_id, pr.pr_number, po.supplier_id, s.supplier_name,
            po.status, po.expected_delivery_date, po.cancel_reason,
            po.created_by_user_id, po.created_by_username, po.sent_by_user_id, po.sent_by_username, po.sent_at,
            po.cancelled_by_user_id, po.cancelled_by_username, po.cancelled_at,
            po.created_at, po.updated_at, COUNT(poi.id) AS item_count
     FROM ${PO_TABLE} po
     LEFT JOIN ${PR_TABLE} pr ON pr.id = po.purchase_requisition_id
     LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = po.supplier_id
     LEFT JOIN ${PO_ITEMS_TABLE} poi ON poi.purchase_order_id = po.id
     ${whereClause}
     GROUP BY po.id, po.po_number, po.purchase_requisition_id, pr.pr_number, po.supplier_id, s.supplier_name,
              po.status, po.expected_delivery_date, po.cancel_reason,
              po.created_by_user_id, po.created_by_username, po.sent_by_user_id, po.sent_by_username, po.sent_at,
              po.cancelled_by_user_id, po.cancelled_by_username, po.cancelled_at, po.created_at, po.updated_at
     ORDER BY po.created_at DESC, po.id DESC`,
    params,
  );

  return rows.map(mapPoRow);
}

async function getOrder(id, branchId) {
  const pool = getPool();
  await ensureProcurementTables(pool);
  const poId = normalizeInteger(id, 'order_id', { min: 1 });
  const po = await getPoById(pool, poId, { branchId });
  if (!po) {
    const error = new Error('Purchase order not found.');
    error.statusCode = 404;
    throw error;
  }
  const items = await getPoItems(pool, poId);
  return { ...mapPoRow({ ...po, item_count: items.length }), items };
}

async function createOrderFromPr(prId, payload = {}, sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const requisitionId = normalizeInteger(prId, 'requisition_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const pr = await getPrById(connection, requisitionId, { forUpdate: true, branchId });
    if (!pr) {
      const error = new Error('Purchase requisition not found.');
      error.statusCode = 404;
      throw error;
    }
    if (pr.status !== 'approved') {
      const error = new Error('Purchase order can only be created from an approved requisition.');
      error.statusCode = 409;
      throw error;
    }

    const supplierId = payload.supplier_id !== undefined && payload.supplier_id !== null
      ? normalizeInteger(payload.supplier_id, 'supplier_id', { min: 1 })
      : pr.preferred_supplier_id;

    if (!supplierId) {
      const error = new Error('supplier_id is required.');
      error.statusCode = 400;
      throw error;
    }

    const supplier = await getSupplierById(connection, supplierId, { branchId });
    if (!supplier) {
      const error = new Error('Supplier not found.');
      error.statusCode = 404;
      throw error;
    }

    const prItems = await getPrItems(connection, requisitionId);
    if (!prItems.length) {
      const error = new Error('Approved requisition has no items.');
      error.statusCode = 400;
      throw error;
    }

    const poNumber = await buildDocumentNumber(connection, 'PO', PO_TABLE, 'po_number', branchId);
    const expectedDeliveryDate = normalizeOptionalDate(payload.expected_delivery_date, 'expected_delivery_date');
    const costByPrItemId = new Map();

    if (Array.isArray(payload.items)) {
      for (const line of payload.items) {
        const prItemId = normalizeInteger(line.purchase_requisition_item_id || line.pr_item_id, 'purchase_requisition_item_id', { min: 1 });
        costByPrItemId.set(prItemId, normalizeDecimal(line.unit_cost, 'unit_cost', { min: 0 }));
      }
    }

    const [poResult] = await connection.query(
      `INSERT INTO ${PO_TABLE}
        (po_number, purchase_requisition_id, supplier_id, status, expected_delivery_date, created_by_user_id, created_by_username, branch_id)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [poNumber, requisitionId, supplierId, expectedDeliveryDate, identity.userId, identity.username, branchId],
    );

    const poId = poResult.insertId;

    for (const prItem of prItems) {
      const unitCost = costByPrItemId.has(prItem.id)
        ? costByPrItemId.get(prItem.id)
        : (payload.default_unit_cost !== undefined
          ? normalizeDecimal(payload.default_unit_cost, 'default_unit_cost', { min: 0 })
          : 0);

      await connection.query(
        `INSERT INTO ${PO_ITEMS_TABLE}
          (purchase_order_id, purchase_requisition_item_id, product_id, product_name, sku, product_barcode,
           qty_ordered, qty_received, unit_cost, sort_order, branch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [poId, prItem.id, prItem.product_id, prItem.product_name, prItem.sku, prItem.product_barcode, prItem.qty_requested, unitCost, prItem.sort_order, branchId],
      );
    }

    await connection.commit();
    return getOrder(poId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOrder(id, payload = {}, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const poId = normalizeInteger(id, 'order_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    await assertDraftPo(connection, poId, branchId);

    if (payload.expected_delivery_date !== undefined) {
      await connection.query(
        `UPDATE ${PO_TABLE} SET expected_delivery_date = ? WHERE id = ? AND branch_id = ?`,
        [normalizeOptionalDate(payload.expected_delivery_date, 'expected_delivery_date'), poId, branchId],
      );
    }

    if (payload.supplier_id !== undefined) {
      const supplierId = normalizeInteger(payload.supplier_id, 'supplier_id', { min: 1 });
      const supplier = await getSupplierById(connection, supplierId, { branchId });
      if (!supplier) {
        const error = new Error('Supplier not found.');
        error.statusCode = 404;
        throw error;
      }
      await connection.query(`UPDATE ${PO_TABLE} SET supplier_id = ? WHERE id = ? AND branch_id = ?`, [supplierId, poId, branchId]);
    }

    if (Array.isArray(payload.items)) {
      for (const line of payload.items) {
        const itemId = normalizeInteger(line.id, 'item_id', { min: 1 });
        const updates = [];
        const params = [];

        if (line.qty_ordered !== undefined) {
          updates.push('qty_ordered = ?');
          params.push(normalizeInteger(line.qty_ordered, 'qty_ordered', { min: 1 }));
        }
        if (line.unit_cost !== undefined) {
          updates.push('unit_cost = ?');
          params.push(normalizeDecimal(line.unit_cost, 'unit_cost', { min: 0 }));
        }

        if (!updates.length) {
          continue;
        }

        params.push(itemId, poId);
        const [result] = await connection.query(
          `UPDATE ${PO_ITEMS_TABLE} SET ${updates.join(', ')} WHERE id = ? AND purchase_order_id = ?`,
          params,
        );

        if (!result.affectedRows) {
          const error = new Error('Purchase order item not found.');
          error.statusCode = 404;
          throw error;
        }
      }
    }

    await connection.commit();
    return getOrder(poId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function sendOrder(id, sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const poId = normalizeInteger(id, 'order_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    await assertDraftPo(connection, poId, branchId);
    const items = await getPoItems(connection, poId);

    if (!items.length) {
      const error = new Error('Purchase order must have at least one item.');
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `UPDATE ${PO_TABLE}
       SET status = 'sent', sent_by_user_id = ?, sent_by_username = ?, sent_at = NOW()
       WHERE id = ?
         AND branch_id = ?`,
      [identity.userId, identity.username, poId, branchId],
    );

    await connection.commit();
    return getOrder(poId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelOrder(id, payload = {}, sessionUser, branchId) {
  const reason = requireReason(payload.reason || payload.cancel_reason, 'cancel_reason');
  const pool = getPool();
  const connection = await pool.getConnection();
  const poId = normalizeInteger(id, 'order_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    const po = await getPoById(connection, poId, { forUpdate: true, branchId });

    if (!po) {
      const error = new Error('Purchase order not found.');
      error.statusCode = 404;
      throw error;
    }
    if (po.status === 'completed') {
      const error = new Error('Completed purchase orders cannot be cancelled.');
      error.statusCode = 409;
      throw error;
    }
    if (po.status === 'cancelled') {
      const error = new Error('Purchase order is already cancelled.');
      error.statusCode = 409;
      throw error;
    }

    await connection.query(
      `UPDATE ${PO_TABLE}
       SET status = 'cancelled', cancel_reason = ?, cancelled_by_user_id = ?, cancelled_by_username = ?, cancelled_at = NOW()
       WHERE id = ?
         AND branch_id = ?`,
      [reason, identity.userId, identity.username, poId, branchId],
    );

    await connection.commit();
    return getOrder(poId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function mapRrRow(row) {
  return {
    id: row.id,
    rr_number: row.rr_number,
    purchase_order_id: row.purchase_order_id,
    po_number: row.po_number || null,
    supplier_dr_number: row.supplier_dr_number,
    status: row.status,
    remarks: row.remarks,
    created_by_user_id: row.created_by_user_id,
    created_by_username: row.created_by_username,
    received_by_user_id: row.received_by_user_id,
    received_by_username: row.received_by_username,
    received_at: row.received_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: Number(row.item_count || 0),
  };
}

function mapRrItemRow(row) {
  return {
    id: row.id,
    receiving_report_id: row.receiving_report_id,
    purchase_order_item_id: row.purchase_order_item_id,
    product_name: row.product_name,
    sku: row.sku,
    product_barcode: row.product_barcode,
    qty_received: Number(row.qty_received || 0),
    item_condition: row.item_condition,
    expiry_date: row.expiry_date,
    batch_number: row.batch_number,
    unit_cost_snapshot: Number(row.unit_cost_snapshot || 0),
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at,
  };
}

async function getRrById(connection, rrId, { forUpdate = false, branchId } = {}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(
    `SELECT rr.*, po.po_number
     FROM ${RR_TABLE} rr
     LEFT JOIN ${PO_TABLE} po ON po.id = rr.purchase_order_id AND po.branch_id = rr.branch_id
     WHERE rr.id = ?
       AND rr.branch_id = ?${lockClause}`,
    [rrId, branchId],
  );
  return rows[0] || null;
}

async function getRrItems(connection, rrId) {
  const [rows] = await connection.query(
    `SELECT id, receiving_report_id, purchase_order_item_id, product_name, sku, product_barcode,
            qty_received, item_condition, expiry_date, batch_number, unit_cost_snapshot, sort_order, created_at
     FROM ${RR_ITEMS_TABLE} WHERE receiving_report_id = ? ORDER BY sort_order ASC, id ASC`,
    [rrId],
  );
  return rows.map(mapRrItemRow);
}

async function assertDraftRr(connection, rrId, branchId) {
  const rr = await getRrById(connection, rrId, { forUpdate: true, branchId });
  if (!rr) {
    const error = new Error('Receiving report not found.');
    error.statusCode = 404;
    throw error;
  }
  if (rr.status !== 'draft') {
    const error = new Error('Only draft receiving reports can be modified.');
    error.statusCode = 409;
    throw error;
  }
  return rr;
}

async function assertReceivablePo(connection, poId, branchId) {
  const po = await getPoById(connection, poId, { forUpdate: true, branchId });
  if (!po) {
    const error = new Error('Purchase order not found.');
    error.statusCode = 404;
    throw error;
  }
  if (!['sent', 'partially_received'].includes(po.status)) {
    const error = new Error('Receiving is only allowed for sent or partially received purchase orders.');
    error.statusCode = 409;
    throw error;
  }
  return po;
}

async function listReceivingReports(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const conditions = ['rr.branch_id = ?'];
  const params = [branchId];
  const status = normalizeText(filters.status);
  const poId = filters.purchase_order_id !== undefined && filters.purchase_order_id !== null && filters.purchase_order_id !== ''
    ? normalizeInteger(filters.purchase_order_id, 'purchase_order_id', { min: 1 })
    : null;

  if (status) {
    conditions.push('rr.status = ?');
    params.push(status);
  }
  if (poId) {
    conditions.push('rr.purchase_order_id = ?');
    params.push(poId);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT rr.id, rr.rr_number, rr.purchase_order_id, po.po_number, rr.supplier_dr_number, rr.status, rr.remarks,
            rr.created_by_user_id, rr.created_by_username, rr.received_by_user_id, rr.received_by_username, rr.received_at,
            rr.created_at, rr.updated_at, COUNT(rri.id) AS item_count
     FROM ${RR_TABLE} rr
     LEFT JOIN ${PO_TABLE} po ON po.id = rr.purchase_order_id
     LEFT JOIN ${RR_ITEMS_TABLE} rri ON rri.receiving_report_id = rr.id
     ${whereClause}
     GROUP BY rr.id, rr.rr_number, rr.purchase_order_id, po.po_number, rr.supplier_dr_number, rr.status, rr.remarks,
              rr.created_by_user_id, rr.created_by_username, rr.received_by_user_id, rr.received_by_username, rr.received_at,
              rr.created_at, rr.updated_at
     ORDER BY rr.created_at DESC, rr.id DESC`,
    params,
  );

  return rows.map(mapRrRow);
}

async function getReceivingReport(id, branchId) {
  const pool = getPool();
  await ensureProcurementTables(pool);
  const rrId = normalizeInteger(id, 'receiving_report_id', { min: 1 });
  const rr = await getRrById(pool, rrId, { branchId });
  if (!rr) {
    const error = new Error('Receiving report not found.');
    error.statusCode = 404;
    throw error;
  }
  const items = await getRrItems(pool, rrId);
  return { ...mapRrRow({ ...rr, item_count: items.length }), items };
}

async function normalizeRrItems(connection, poId, items) {
  if (!Array.isArray(items) || !items.length) {
    const error = new Error('At least one receiving item is required.');
    error.statusCode = 400;
    throw error;
  }

  const poItems = await getPoItems(connection, poId);
  const poItemMap = new Map(poItems.map((row) => [row.id, row]));
  const normalized = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const poItemId = normalizeInteger(item.purchase_order_item_id, `items[${index}].purchase_order_item_id`, { min: 1 });
    const poItem = poItemMap.get(poItemId);

    if (!poItem) {
      const error = new Error(`Purchase order item ${poItemId} not found on this order.`);
      error.statusCode = 404;
      throw error;
    }

    const qtyReceived = normalizeInteger(item.qty_received, `items[${index}].qty_received`, { min: 0 });
    const condition = normalizeText(item.item_condition) || 'good';

    if (!['good', 'damaged'].includes(condition)) {
      const error = new Error(`items[${index}].item_condition must be good or damaged.`);
      error.statusCode = 400;
      throw error;
    }

    normalized.push({
      purchase_order_item_id: poItemId,
      product_name: poItem.product_name,
      sku: poItem.sku,
      product_barcode: poItem.product_barcode,
      qty_received: qtyReceived,
      item_condition: condition,
      expiry_date: normalizeOptionalDate(item.expiry_date, 'expiry_date'),
      batch_number: normalizeText(item.batch_number),
      unit_cost_snapshot: item.unit_cost !== undefined
        ? normalizeDecimal(item.unit_cost, 'unit_cost', { min: 0 })
        : poItem.unit_cost,
      sort_order: index + 1,
    });
  }

  return normalized;
}

async function createReceivingReport(poId, payload = {}, sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const orderId = normalizeInteger(poId, 'order_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    await assertReceivablePo(connection, orderId, branchId);

    const items = await normalizeRrItems(connection, orderId, payload.items);
    const rrNumber = await buildDocumentNumber(connection, 'RR', RR_TABLE, 'rr_number', branchId);

    const [rrResult] = await connection.query(
      `INSERT INTO ${RR_TABLE}
        (rr_number, purchase_order_id, supplier_dr_number, status, remarks, created_by_user_id, created_by_username, branch_id)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [rrNumber, orderId, normalizeText(payload.supplier_dr_number), normalizeText(payload.remarks), identity.userId, identity.username, branchId],
    );

    const rrId = rrResult.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO ${RR_ITEMS_TABLE}
          (receiving_report_id, purchase_order_item_id, product_name, sku, product_barcode,
           qty_received, item_condition, expiry_date, batch_number, unit_cost_snapshot, sort_order, branch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rrId, item.purchase_order_item_id, item.product_name, item.sku, item.product_barcode,
          item.qty_received, item.item_condition, item.expiry_date, item.batch_number, item.unit_cost_snapshot, item.sort_order, branchId],
      );
    }

    await connection.commit();
    return getReceivingReport(rrId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateReceivingReport(id, payload = {}, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const rrId = normalizeInteger(id, 'receiving_report_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    const rr = await assertDraftRr(connection, rrId, branchId);

    if (payload.supplier_dr_number !== undefined) {
      await connection.query(`UPDATE ${RR_TABLE} SET supplier_dr_number = ? WHERE id = ? AND branch_id = ?`, [normalizeText(payload.supplier_dr_number), rrId, branchId]);
    }
    if (payload.remarks !== undefined) {
      await connection.query(`UPDATE ${RR_TABLE} SET remarks = ? WHERE id = ? AND branch_id = ?`, [normalizeText(payload.remarks), rrId, branchId]);
    }

    if (payload.items !== undefined) {
      const items = await normalizeRrItems(connection, rr.purchase_order_id, payload.items);
      await connection.query(`DELETE FROM ${RR_ITEMS_TABLE} WHERE receiving_report_id = ?`, [rrId]);
      for (const item of items) {
        await connection.query(
          `INSERT INTO ${RR_ITEMS_TABLE}
            (receiving_report_id, purchase_order_item_id, product_name, sku, product_barcode,
             qty_received, item_condition, expiry_date, batch_number, unit_cost_snapshot, sort_order, branch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rrId, item.purchase_order_item_id, item.product_name, item.sku, item.product_barcode,
            item.qty_received, item.item_condition, item.expiry_date, item.batch_number, item.unit_cost_snapshot, item.sort_order, branchId],
        );
      }
    }

    await connection.commit();
    return getReceivingReport(rrId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function confirmReceivingReport(id, sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const rrId = normalizeInteger(id, 'receiving_report_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const rr = await assertDraftRr(connection, rrId, branchId);
    const items = await getRrItems(connection, rrId);

    if (!items.length) {
      const error = new Error('Receiving report must have at least one item.');
      error.statusCode = 400;
      throw error;
    }

    const po = await getPoById(connection, rr.purchase_order_id, { forUpdate: true, branchId });
    const poItems = await getPoItems(connection, rr.purchase_order_id);
    const poItemMap = new Map(poItems.map((row) => [row.id, row]));
    const receivedDelta = new Map();

    for (const item of items) {
      if (item.item_condition !== 'good' || item.qty_received <= 0) {
        continue;
      }

      const poItem = poItemMap.get(item.purchase_order_item_id);
      if (!poItem) {
        const error = new Error('Receiving item references an invalid purchase order line.');
        error.statusCode = 409;
        throw error;
      }

      const [productRows] = await connection.query(
        `SELECT COALESCE(rop, 0) AS rop FROM products WHERE product_barcode = ? AND branch_id = ? LIMIT 1`,
        [item.product_barcode, branchId],
      );
      const rop = Number(productRows[0]?.rop || 0);
      const batchId = await buildBatchId(connection, item.batch_number, item.product_barcode, branchId);

      await connection.query(
        `INSERT INTO product_batches
          (batch_id, batch_date, product_barcode, Qty, cost_price, selling_price, quantity_remaining, reoder_point, ExpiryDate, UserID, Block, branch_id)
         VALUES (?, CURDATE(), ?, ?, ?, 0, ?, ?, ?, ?, 0, ?)`,
        [batchId, item.product_barcode, item.qty_received, item.unit_cost_snapshot, item.qty_received, rop, item.expiry_date, identity.userId, branchId],
      );

      receivedDelta.set(item.purchase_order_item_id, (receivedDelta.get(item.purchase_order_item_id) || 0) + item.qty_received);
    }

    for (const [poItemId, qtyGood] of receivedDelta.entries()) {
      const poItem = poItemMap.get(poItemId);
      const newQtyReceived = Number(poItem.qty_received || 0) + qtyGood;
      await connection.query(
        `UPDATE ${PO_ITEMS_TABLE} SET qty_received = ? WHERE id = ?`,
        [newQtyReceived, poItemId],
      );
      poItem.qty_received = newQtyReceived;
    }

    const updatedPoItems = await getPoItems(connection, rr.purchase_order_id);
    const allFullyReceived = updatedPoItems.every((line) => Number(line.qty_received || 0) >= Number(line.qty_ordered || 0));
    const anyReceived = updatedPoItems.some((line) => Number(line.qty_received || 0) > 0);
    const nextPoStatus = allFullyReceived ? 'completed' : (anyReceived ? 'partially_received' : po.status);

    await connection.query(`UPDATE ${PO_TABLE} SET status = ? WHERE id = ? AND branch_id = ?`, [nextPoStatus, rr.purchase_order_id, branchId]);
    await connection.query(
      `UPDATE ${RR_TABLE}
       SET status = 'confirmed', received_by_user_id = ?, received_by_username = ?, received_at = NOW()
       WHERE id = ?
         AND branch_id = ?`,
      [identity.userId, identity.username, rrId, branchId],
    );

    await connection.commit();
    return getReceivingReport(rrId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function mapInvoiceRow(row) {
  return {
    id: row.id,
    purchase_order_id: row.purchase_order_id,
    po_number: row.po_number || null,
    invoice_number: row.invoice_number,
    status: row.status,
    invoice_date: row.invoice_date,
    amount_total: Number(row.amount_total || 0),
    payment_terms: row.payment_terms,
    created_by_user_id: row.created_by_user_id,
    created_by_username: row.created_by_username,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapInvoiceItemRow(row) {
  return {
    id: row.id,
    supplier_invoice_id: row.supplier_invoice_id,
    purchase_order_item_id: row.purchase_order_item_id,
    product_name: row.product_name,
    sku: row.sku,
    product_barcode: row.product_barcode,
    qty_invoiced: Number(row.qty_invoiced || 0),
    unit_price: Number(row.unit_price || 0),
    line_total: Number(row.line_total || 0),
    sort_order: Number(row.sort_order || 0),
  };
}

async function getInvoiceByPoId(connection, poId, branchId) {
  const [rows] = await connection.query(
    `SELECT si.*, po.po_number FROM ${SI_TABLE} si
     LEFT JOIN ${PO_TABLE} po ON po.id = si.purchase_order_id AND po.branch_id = si.branch_id
     WHERE si.purchase_order_id = ?
       AND si.branch_id = ?
     ORDER BY si.id DESC LIMIT 1`,
    [poId, branchId],
  );
  return rows[0] || null;
}

async function getInvoiceById(connection, invoiceId, { forUpdate = false, branchId } = {}) {
  const lockClause = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(
    `SELECT si.*, po.po_number FROM ${SI_TABLE} si
     LEFT JOIN ${PO_TABLE} po ON po.id = si.purchase_order_id AND po.branch_id = si.branch_id
     WHERE si.id = ?
       AND si.branch_id = ?${lockClause}`,
    [invoiceId, branchId],
  );
  return rows[0] || null;
}

async function getInvoiceItems(connection, invoiceId) {
  const [rows] = await connection.query(
    `SELECT id, supplier_invoice_id, purchase_order_item_id, product_name, sku, product_barcode,
            qty_invoiced, unit_price, line_total, sort_order
     FROM ${SI_ITEMS_TABLE} WHERE supplier_invoice_id = ? ORDER BY sort_order ASC, id ASC`,
    [invoiceId],
  );
  return rows.map(mapInvoiceItemRow);
}

async function normalizeInvoiceItems(connection, poId, items) {
  if (!Array.isArray(items) || !items.length) {
    const error = new Error('At least one invoice item is required.');
    error.statusCode = 400;
    throw error;
  }

  const poItems = await getPoItems(connection, poId);
  const poItemMap = new Map(poItems.map((row) => [row.id, row]));
  const normalized = [];
  let amountTotal = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const poItemId = normalizeInteger(item.purchase_order_item_id, `items[${index}].purchase_order_item_id`, { min: 1 });
    const poItem = poItemMap.get(poItemId);

    if (!poItem) {
      const error = new Error(`Purchase order item ${poItemId} not found.`);
      error.statusCode = 404;
      throw error;
    }

    const qtyInvoiced = normalizeInteger(item.qty_invoiced, `items[${index}].qty_invoiced`, { min: 0 });
    const unitPrice = normalizeDecimal(item.unit_price !== undefined ? item.unit_price : poItem.unit_cost, 'unit_price', { min: 0 });
    const lineTotal = Number((qtyInvoiced * unitPrice).toFixed(2));
    amountTotal += lineTotal;

    normalized.push({
      purchase_order_item_id: poItemId,
      product_name: poItem.product_name,
      sku: poItem.sku,
      product_barcode: poItem.product_barcode,
      qty_invoiced: qtyInvoiced,
      unit_price: unitPrice,
      line_total: lineTotal,
      sort_order: index + 1,
    });
  }

  return { items: normalized, amountTotal: Number(amountTotal.toFixed(2)) };
}

async function createInvoice(payload = {}, sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const identity = getSessionIdentity(sessionUser);
  const poId = normalizeInteger(payload.purchase_order_id, 'purchase_order_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const po = await getPoById(connection, poId, { branchId });
    if (!po) {
      const error = new Error('Purchase order not found.');
      error.statusCode = 404;
      throw error;
    }

    const invoiceNumber = normalizeText(payload.invoice_number);
    if (!invoiceNumber) {
      const error = new Error('invoice_number is required.');
      error.statusCode = 400;
      throw error;
    }

    const { items, amountTotal } = await normalizeInvoiceItems(connection, poId, payload.items);

    const [result] = await connection.query(
      `INSERT INTO ${SI_TABLE}
        (purchase_order_id, invoice_number, status, invoice_date, amount_total, payment_terms, created_by_user_id, created_by_username, branch_id)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
      [poId, invoiceNumber, normalizeOptionalDate(payload.invoice_date, 'invoice_date'), amountTotal,
        normalizeText(payload.payment_terms), identity.userId, identity.username, branchId],
    );

    for (const item of items) {
      await connection.query(
        `INSERT INTO ${SI_ITEMS_TABLE}
          (supplier_invoice_id, purchase_order_item_id, product_name, sku, product_barcode, qty_invoiced, unit_price, line_total, sort_order, branch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, item.purchase_order_item_id, item.product_name, item.sku, item.product_barcode,
          item.qty_invoiced, item.unit_price, item.line_total, item.sort_order, branchId],
      );
    }

    await connection.commit();
    return getInvoice(result.insertId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getInvoice(id, branchId) {
  const pool = getPool();
  await ensureProcurementTables(pool);
  const invoiceId = normalizeInteger(id, 'invoice_id', { min: 1 });
  const invoice = await getInvoiceById(pool, invoiceId, { branchId });

  if (!invoice) {
    const error = new Error('Supplier invoice not found.');
    error.statusCode = 404;
    throw error;
  }

  const items = await getInvoiceItems(pool, invoiceId);
  return { ...mapInvoiceRow(invoice), items };
}

async function updateInvoice(id, payload = {}, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const invoiceId = normalizeInteger(id, 'invoice_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();
    const invoice = await getInvoiceById(connection, invoiceId, { forUpdate: true, branchId });

    if (!invoice) {
      const error = new Error('Supplier invoice not found.');
      error.statusCode = 404;
      throw error;
    }
    if (invoice.status !== 'draft') {
      const error = new Error('Only draft supplier invoices can be modified.');
      error.statusCode = 409;
      throw error;
    }

    if (payload.invoice_number !== undefined) {
      const invoiceNumber = normalizeText(payload.invoice_number);
      if (!invoiceNumber) {
        const error = new Error('invoice_number is required.');
        error.statusCode = 400;
        throw error;
      }
      await connection.query(`UPDATE ${SI_TABLE} SET invoice_number = ? WHERE id = ? AND branch_id = ?`, [invoiceNumber, invoiceId, branchId]);
    }

    if (payload.invoice_date !== undefined) {
      await connection.query(`UPDATE ${SI_TABLE} SET invoice_date = ? WHERE id = ? AND branch_id = ?`, [normalizeOptionalDate(payload.invoice_date, 'invoice_date'), invoiceId, branchId]);
    }
    if (payload.payment_terms !== undefined) {
      await connection.query(`UPDATE ${SI_TABLE} SET payment_terms = ? WHERE id = ? AND branch_id = ?`, [normalizeText(payload.payment_terms), invoiceId, branchId]);
    }

    if (payload.items !== undefined) {
      const { items, amountTotal } = await normalizeInvoiceItems(connection, invoice.purchase_order_id, payload.items);
      await connection.query(`DELETE FROM ${SI_ITEMS_TABLE} WHERE supplier_invoice_id = ?`, [invoiceId]);
      for (const item of items) {
        await connection.query(
          `INSERT INTO ${SI_ITEMS_TABLE}
            (supplier_invoice_id, purchase_order_item_id, product_name, sku, product_barcode, qty_invoiced, unit_price, line_total, sort_order, branch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [invoiceId, item.purchase_order_item_id, item.product_name, item.sku, item.product_barcode,
            item.qty_invoiced, item.unit_price, item.line_total, item.sort_order, branchId],
        );
      }
      await connection.query(`UPDATE ${SI_TABLE} SET amount_total = ? WHERE id = ? AND branch_id = ?`, [amountTotal, invoiceId, branchId]);
    }

    await connection.commit();
    return getInvoice(invoiceId, branchId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getConfirmedGoodQtyByPo(connection, poId) {
  const [rows] = await connection.query(
    `SELECT rri.purchase_order_item_id, COALESCE(SUM(CASE WHEN rri.item_condition = 'good' THEN rri.qty_received ELSE 0 END), 0) AS qty_good
     FROM ${RR_ITEMS_TABLE} rri
     INNER JOIN ${RR_TABLE} rr ON rr.id = rri.receiving_report_id
     WHERE rr.purchase_order_id = ? AND rr.status = 'confirmed'
     GROUP BY rri.purchase_order_item_id`,
    [poId],
  );
  return new Map(rows.map((row) => [row.purchase_order_item_id, Number(row.qty_good || 0)]));
}

async function runThreeWayMatch(poId, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const orderId = normalizeInteger(poId, 'order_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const po = await getPoById(connection, orderId, { branchId });
    if (!po) {
      const error = new Error('Purchase order not found.');
      error.statusCode = 404;
      throw error;
    }

    const poItems = await getPoItems(connection, orderId);
    const receivedMap = await getConfirmedGoodQtyByPo(connection, orderId);
    const invoice = await getInvoiceByPoId(connection, orderId, branchId);
    const invoiceItems = invoice ? await getInvoiceItems(connection, invoice.id) : [];
    const invoiceMap = new Map(invoiceItems.map((row) => [row.purchase_order_item_id, row]));

    const discrepancies = [];
    let poTotal = 0;
    let receivedTotal = 0;
    let invoiceTotal = 0;

    for (const line of poItems) {
      const qtyOrdered = Number(line.qty_ordered || 0);
      const qtyReceived = receivedMap.get(line.id) || 0;
      const invLine = invoiceMap.get(line.id);
      const qtyInvoiced = invLine ? Number(invLine.qty_invoiced || 0) : 0;
      const poAmount = qtyOrdered * Number(line.unit_cost || 0);
      const recvAmount = qtyReceived * Number(line.unit_cost || 0);
      const invAmount = invLine ? Number(invLine.line_total || 0) : 0;

      poTotal += poAmount;
      receivedTotal += recvAmount;
      invoiceTotal += invAmount;

      if (qtyReceived !== qtyOrdered || qtyInvoiced !== qtyOrdered || Math.abs(invAmount - poAmount) > 0.01) {
        discrepancies.push({
          purchase_order_item_id: line.id,
          product_barcode: line.product_barcode,
          product_name: line.product_name,
          qty_ordered: qtyOrdered,
          qty_received_good: qtyReceived,
          qty_invoiced: qtyInvoiced,
          po_amount: Number(poAmount.toFixed(2)),
          received_amount: Number(recvAmount.toFixed(2)),
          invoice_amount: Number(invAmount.toFixed(2)),
        });
      }
    }

    const status = discrepancies.length ? 'discrepancy' : 'needs_review';
    const discrepancyJson = JSON.stringify({
      discrepancies,
      totals: { po_total: Number(poTotal.toFixed(2)), received_total: Number(receivedTotal.toFixed(2)), invoice_total: Number(invoiceTotal.toFixed(2)) },
    });

    const [existing] = await connection.query(`SELECT id FROM ${MATCH_TABLE} WHERE purchase_order_id = ? AND branch_id = ?`, [orderId, branchId]);

    if (existing.length) {
      await connection.query(
        `UPDATE ${MATCH_TABLE} SET status = ?, discrepancy_json = ?, reviewed_by_user_id = NULL, reviewed_by_username = NULL, reviewed_at = NULL WHERE purchase_order_id = ? AND branch_id = ?`,
        [status, discrepancyJson, orderId, branchId],
      );
    } else {
      await connection.query(
        `INSERT INTO ${MATCH_TABLE} (purchase_order_id, status, discrepancy_json, branch_id) VALUES (?, ?, ?, ?)`,
        [orderId, status, discrepancyJson, branchId],
      );
    }

    await connection.commit();

    const [matchRows] = await pool.query(
      `SELECT id, purchase_order_id, status, discrepancy_json, reviewed_by_user_id, reviewed_by_username, reviewed_at, created_at, updated_at
       FROM ${MATCH_TABLE} WHERE purchase_order_id = ? AND branch_id = ?`,
      [orderId, branchId],
    );

    const match = matchRows[0];
    return {
      ...match,
      discrepancy: match.discrepancy_json ? JSON.parse(match.discrepancy_json) : null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function approveThreeWayMatch(poId, sessionUser, branchId) {
  assertApprover(sessionUser);
  const pool = getPool();
  const connection = await pool.getConnection();
  const orderId = normalizeInteger(poId, 'order_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, status, discrepancy_json FROM ${MATCH_TABLE} WHERE purchase_order_id = ? AND branch_id = ? FOR UPDATE`,
      [orderId, branchId],
    );

    if (!rows.length) {
      const error = new Error('Three-way match review not found. Run match first.');
      error.statusCode = 404;
      throw error;
    }

    const match = rows[0];
    if (match.status === 'discrepancy') {
      const error = new Error('Cannot approve match with unresolved discrepancies.');
      error.statusCode = 409;
      throw error;
    }

    await connection.query(
      `UPDATE ${MATCH_TABLE}
       SET status = 'approved_for_payment', reviewed_by_user_id = ?, reviewed_by_username = ?, reviewed_at = NOW()
       WHERE purchase_order_id = ?
         AND branch_id = ?`,
      [identity.userId, identity.username, orderId, branchId],
    );

    await connection.commit();

    const [updated] = await pool.query(`SELECT * FROM ${MATCH_TABLE} WHERE purchase_order_id = ? AND branch_id = ?`, [orderId, branchId]);
    return {
      ...updated[0],
      discrepancy: updated[0].discrepancy_json ? JSON.parse(updated[0].discrepancy_json) : null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function mapPayableRow(row) {
  return {
    id: row.id,
    purchase_order_id: row.purchase_order_id,
    po_number: row.po_number || null,
    supplier_invoice_id: row.supplier_invoice_id,
    supplier_id: row.supplier_id,
    supplier_name: row.supplier_name || null,
    status: row.status,
    amount_due: Number(row.amount_due || 0),
    amount_paid: Number(row.amount_paid || 0),
    balance: Number((Number(row.amount_due || 0) - Number(row.amount_paid || 0)).toFixed(2)),
    payment_terms: row.payment_terms,
    payment_date: row.payment_date,
    payment_method: row.payment_method,
    paid_by_user_id: row.paid_by_user_id,
    paid_by_username: row.paid_by_username,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listPayables(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const conditions = ['ap.branch_id = ?'];
  const params = [branchId];
  const status = normalizeText(filters.status);

  if (status) {
    conditions.push('ap.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT ap.*, po.po_number, s.supplier_name
     FROM ${AP_TABLE} ap
     LEFT JOIN ${PO_TABLE} po ON po.id = ap.purchase_order_id
     LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = ap.supplier_id
     ${whereClause}
     ORDER BY ap.created_at DESC, ap.id DESC`,
    params,
  );

  return rows.map(mapPayableRow);
}

async function createPayableFromPo(poId, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const orderId = normalizeInteger(poId, 'order_id', { min: 1 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const po = await getPoById(connection, orderId, { branchId });
    if (!po) {
      const error = new Error('Purchase order not found.');
      error.statusCode = 404;
      throw error;
    }

    const [existing] = await connection.query(`SELECT id FROM ${AP_TABLE} WHERE purchase_order_id = ? AND branch_id = ? LIMIT 1`, [orderId, branchId]);
    if (existing.length) {
      const error = new Error('Accounts payable record already exists for this purchase order.');
      error.statusCode = 409;
      throw error;
    }

    const invoice = await getInvoiceByPoId(connection, orderId, branchId);
    const supplier = await getSupplierById(connection, po.supplier_id, { branchId });
    const amountDue = invoice ? Number(invoice.amount_total || 0) : 0;

    const [result] = await connection.query(
      `INSERT INTO ${AP_TABLE}
        (purchase_order_id, supplier_invoice_id, supplier_id, status, amount_due, amount_paid, payment_terms, branch_id)
       VALUES (?, ?, ?, 'unpaid', ?, 0, ?, ?)`,
      [orderId, invoice?.id || null, po.supplier_id, amountDue, invoice?.payment_terms || supplier?.payment_terms || 'Net 30', branchId],
    );

    await connection.commit();

    const [rows] = await pool.query(
      `SELECT ap.*, po.po_number, s.supplier_name FROM ${AP_TABLE} ap
       LEFT JOIN ${PO_TABLE} po ON po.id = ap.purchase_order_id
       LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = ap.supplier_id WHERE ap.id = ? AND ap.branch_id = ?`,
      [result.insertId, branchId],
    );

    return mapPayableRow(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordPayment(id, payload = {}, sessionUser, branchId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const payableId = normalizeInteger(id, 'payable_id', { min: 1 });
  const identity = getSessionIdentity(sessionUser);
  const paymentAmount = normalizeDecimal(payload.amount || payload.amount_paid, 'amount', { min: 0.01 });

  try {
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const [payableRows] = await connection.query(
      `SELECT ap.*, po.po_number FROM ${AP_TABLE} ap
       LEFT JOIN ${PO_TABLE} po ON po.id = ap.purchase_order_id
       WHERE ap.id = ?
         AND ap.branch_id = ? FOR UPDATE`,
      [payableId, branchId],
    );

    if (!payableRows.length) {
      const error = new Error('Accounts payable record not found.');
      error.statusCode = 404;
      throw error;
    }

    const payable = payableRows[0];
    const [matchRows] = await connection.query(
      `SELECT status FROM ${MATCH_TABLE} WHERE purchase_order_id = ? AND branch_id = ?`,
      [payable.purchase_order_id, branchId],
    );

    if (!matchRows.length || matchRows[0].status !== 'approved_for_payment') {
      const error = new Error('Payment is only allowed when three-way match is approved for payment.');
      error.statusCode = 409;
      throw error;
    }

    const newAmountPaid = Number(payable.amount_paid || 0) + paymentAmount;
    const amountDue = Number(payable.amount_due || 0);

    if (newAmountPaid > amountDue + 0.01) {
      const error = new Error('Payment amount exceeds amount due.');
      error.statusCode = 400;
      throw error;
    }

    const nextStatus = newAmountPaid >= amountDue - 0.01 ? 'paid' : 'partial';

    await connection.query(
      `UPDATE ${AP_TABLE}
       SET amount_paid = ?, status = ?, payment_date = ?, payment_method = ?,
           paid_by_user_id = ?, paid_by_username = ?
       WHERE id = ?
         AND branch_id = ?`,
      [
        Number(newAmountPaid.toFixed(2)),
        nextStatus,
        normalizeOptionalDate(payload.payment_date, 'payment_date') || new Date().toISOString().slice(0, 10),
        normalizeText(payload.payment_method),
        identity.userId,
        identity.username,
        payableId,
        branchId,
      ],
    );

    await connection.commit();

    const [rows] = await pool.query(
      `SELECT ap.*, po.po_number, s.supplier_name FROM ${AP_TABLE} ap
       LEFT JOIN ${PO_TABLE} po ON po.id = ap.purchase_order_id
       LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = ap.supplier_id WHERE ap.id = ? AND ap.branch_id = ?`,
      [payableId, branchId],
    );

    return mapPayableRow(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getPayablesAging(branchId) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const [rows] = await pool.query(
    `SELECT ap.id, ap.purchase_order_id, po.po_number, ap.supplier_id, s.supplier_name,
            ap.amount_due, ap.amount_paid, (ap.amount_due - ap.amount_paid) AS balance,
            ap.status, ap.created_at,
            DATEDIFF(CURDATE(), DATE(ap.created_at)) AS days_outstanding
     FROM ${AP_TABLE} ap
     LEFT JOIN ${PO_TABLE} po ON po.id = ap.purchase_order_id
     LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = ap.supplier_id
     WHERE ap.branch_id = ?
       AND ap.status IN ('unpaid', 'partial')
     ORDER BY ap.created_at ASC`,
    [branchId],
  );

  const buckets = { current: [], days_1_30: [], days_31_60: [], days_61_90: [], days_90_plus: [] };

  for (const row of rows) {
    const entry = {
      ...mapPayableRow({ ...row, po_number: row.po_number, supplier_name: row.supplier_name }),
      days_outstanding: Number(row.days_outstanding || 0),
    };
    const days = entry.days_outstanding;

    if (days <= 0) {
      buckets.current.push(entry);
    } else if (days <= 30) {
      buckets.days_1_30.push(entry);
    } else if (days <= 60) {
      buckets.days_31_60.push(entry);
    } else if (days <= 90) {
      buckets.days_61_90.push(entry);
    } else {
      buckets.days_90_plus.push(entry);
    }
  }

  const sumBalance = (list) => list.reduce((sum, row) => sum + Number(row.balance || 0), 0);

  return {
    buckets,
    summary: {
      current: sumBalance(buckets.current),
      days_1_30: sumBalance(buckets.days_1_30),
      days_31_60: sumBalance(buckets.days_31_60),
      days_61_90: sumBalance(buckets.days_61_90),
      days_90_plus: sumBalance(buckets.days_90_plus),
      total_outstanding: sumBalance(rows.map((row) => mapPayableRow({ ...row, po_number: row.po_number, supplier_name: row.supplier_name }))),
    },
  };
}

async function getRequisitionReport(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const dateFrom = normalizeDateFilter(filters.date_from || filters.dateFrom, 'date_from');
  const dateTo = normalizeDateFilter(filters.date_to || filters.dateTo, 'date_to');
  const status = normalizeText(filters.status);
  const conditions = ['pr.branch_id = ?'];
  const params = [branchId];

  if (status) {
    conditions.push('pr.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('DATE(pr.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(pr.created_at) <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [summaryRows] = await pool.query(
    `SELECT pr.status, COUNT(*) AS count
     FROM ${PR_TABLE} pr ${whereClause}
     GROUP BY pr.status ORDER BY pr.status ASC`,
    params,
  );

  const [detailRows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.status, pr.created_by_username, pr.created_at,
            pri.product_name, pri.product_barcode, pri.qty_requested
     FROM ${PR_TABLE} pr
     LEFT JOIN ${PR_ITEMS_TABLE} pri ON pri.purchase_requisition_id = pr.id
     ${whereClause}
     ORDER BY pr.created_at DESC, pr.id DESC, pri.sort_order ASC`,
    params,
  );

  return { summary: summaryRows, details: detailRows };
}

async function getOrderReport(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const dateFrom = normalizeDateFilter(filters.date_from || filters.dateFrom, 'date_from');
  const dateTo = normalizeDateFilter(filters.date_to || filters.dateTo, 'date_to');
  const status = normalizeText(filters.status);
  const conditions = ['po.branch_id = ?'];
  const params = [branchId];

  if (status) {
    conditions.push('po.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('DATE(po.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(po.created_at) <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [summaryRows] = await pool.query(
    `SELECT po.status, COUNT(*) AS count, COALESCE(SUM(line.line_total), 0) AS total_value
     FROM ${PO_TABLE} po
     LEFT JOIN (
       SELECT purchase_order_id, SUM(qty_ordered * unit_cost) AS line_total
       FROM ${PO_ITEMS_TABLE} GROUP BY purchase_order_id
     ) line ON line.purchase_order_id = po.id
     ${whereClause}
     GROUP BY po.status ORDER BY po.status ASC`,
    params,
  );

  const [detailRows] = await pool.query(
    `SELECT po.id, po.po_number, po.status, s.supplier_name, po.created_at,
            poi.product_name, poi.product_barcode, poi.qty_ordered, poi.qty_received, poi.unit_cost
     FROM ${PO_TABLE} po
     LEFT JOIN ${SUPPLIERS_TABLE} s ON s.id = po.supplier_id
     LEFT JOIN ${PO_ITEMS_TABLE} poi ON poi.purchase_order_id = po.id
     ${whereClause}
     ORDER BY po.created_at DESC, po.id DESC, poi.sort_order ASC`,
    params,
  );

  return { summary: summaryRows, details: detailRows };
}

async function getReceivingReportList(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const dateFrom = normalizeDateFilter(filters.date_from || filters.dateFrom, 'date_from');
  const dateTo = normalizeDateFilter(filters.date_to || filters.dateTo, 'date_to');
  const status = normalizeText(filters.status);
  const conditions = ['rr.branch_id = ?'];
  const params = [branchId];

  if (status) {
    conditions.push('rr.status = ?');
    params.push(status);
  }
  if (dateFrom) {
    conditions.push('DATE(rr.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(rr.created_at) <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT rr.id, rr.rr_number, rr.status, po.po_number, rr.supplier_dr_number,
            rr.received_by_username, rr.received_at, rr.created_at,
            rri.product_name, rri.product_barcode, rri.qty_received, rri.item_condition
     FROM ${RR_TABLE} rr
     LEFT JOIN ${PO_TABLE} po ON po.id = rr.purchase_order_id
     LEFT JOIN ${RR_ITEMS_TABLE} rri ON rri.receiving_report_id = rr.id
     ${whereClause}
     ORDER BY rr.created_at DESC, rr.id DESC, rri.sort_order ASC`,
    params,
  );

  return rows;
}

async function getMatchingReport(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const status = normalizeText(filters.status);
  const conditions = ['mr.branch_id = ?'];
  const params = [branchId];

  if (status) {
    conditions.push('mr.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT mr.id, mr.purchase_order_id, po.po_number, mr.status, mr.discrepancy_json,
            mr.reviewed_by_username, mr.reviewed_at, mr.created_at, mr.updated_at
     FROM ${MATCH_TABLE} mr
     LEFT JOIN ${PO_TABLE} po ON po.id = mr.purchase_order_id
     ${whereClause}
     ORDER BY mr.updated_at DESC, mr.id DESC`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    purchase_order_id: row.purchase_order_id,
    po_number: row.po_number,
    status: row.status,
    discrepancy: row.discrepancy_json ? JSON.parse(row.discrepancy_json) : null,
    reviewed_by_username: row.reviewed_by_username,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

async function getProcurementAuditTrail(filters = {}) {
  const pool = getPool();
  await ensureProcurementTables(pool);

  const branchId = filters.branchId;
  const status = normalizeText(filters.status);
  const poId = filters.purchase_order_id !== undefined && filters.purchase_order_id !== null && filters.purchase_order_id !== ''
    ? normalizeInteger(filters.purchase_order_id, 'purchase_order_id', { min: 1 })
    : null;
  const dateFrom = normalizeDateFilter(filters.date_from || filters.dateFrom, 'date_from');
  const dateTo = normalizeDateFilter(filters.date_to || filters.dateTo, 'date_to');

  const conditions = ['mr.branch_id = ?'];
  const params = [branchId];

  if (status) {
    conditions.push('mr.status = ?');
    params.push(status);
  }
  if (poId) {
    conditions.push('mr.purchase_order_id = ?');
    params.push(poId);
  }
  if (dateFrom) {
    conditions.push('DATE(mr.updated_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(mr.updated_at) <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [matchReviews] = await pool.query(
    `SELECT mr.id, mr.purchase_order_id, po.po_number, mr.status, mr.discrepancy_json,
            mr.reviewed_by_user_id, mr.reviewed_by_username, mr.reviewed_at, mr.created_at, mr.updated_at
     FROM ${MATCH_TABLE} mr
     LEFT JOIN ${PO_TABLE} po ON po.id = mr.purchase_order_id
     ${whereClause}
     ORDER BY mr.updated_at DESC, mr.id DESC`,
    params,
  );

  return {
    match_reviews: matchReviews.map((row) => ({
      id: row.id,
      purchase_order_id: row.purchase_order_id,
      po_number: row.po_number,
      status: row.status,
      discrepancy: row.discrepancy_json ? JSON.parse(row.discrepancy_json) : null,
      reviewed_by_user_id: row.reviewed_by_user_id,
      reviewed_by_username: row.reviewed_by_username,
      reviewed_at: row.reviewed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
  };
}

module.exports = {
  ensureProcurementTables,
  listReorderAlerts,
  listSuppliers,
  createSupplier,
  updateSupplier,
  listRequisitions,
  getRequisition,
  createRequisition,
  updateRequisition,
  deleteRequisition,
  submitRequisition,
  approveRequisition,
  rejectRequisition,
  resubmitRequisition,
  listOrders,
  getOrder,
  createOrderFromPr,
  updateOrder,
  sendOrder,
  cancelOrder,
  listReceivingReports,
  getReceivingReport,
  createReceivingReport,
  updateReceivingReport,
  confirmReceivingReport,
  createInvoice,
  getInvoice,
  updateInvoice,
  runThreeWayMatch,
  approveThreeWayMatch,
  listPayables,
  createPayableFromPo,
  recordPayment,
  getPayablesAging,
  getRequisitionReport,
  getOrderReport,
  getReceivingReportList,
  getMatchingReport,
  getProcurementAuditTrail,
  isApprover,
  buildDocumentNumber,
};
