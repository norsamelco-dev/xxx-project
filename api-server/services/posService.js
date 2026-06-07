const { getPool } = require('../db');
const { getReceiptHeading } = require('./receiptHeadingService');
const { assertTransactionAccess, listSalesItemsByTransaction } = require('./salesService');

const DEFAULT_VAT_RATE = 0.12;
const INSUFFICIENT_STOCK_MESSAGE =
  'Insufficient stock. Maximum available qty for this product has been reached.';

function branchIdFromUser(user) {
  const branchId = Number(user?.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error('Branch context is required.');
    error.statusCode = 403;
    throw error;
  }
  return branchId;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayCompactDate() {
  return todayDateString().replace(/-/g, '');
}

async function getVatRate(branchId) {
  try {
    const heading = await getReceiptHeading(branchId);
    const rate = Number(heading?.vat_rate);
    return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_VAT_RATE;
  } catch {
    return DEFAULT_VAT_RATE;
  }
}

function computeSaleTotals(lineTotals, discountRate, vatRate) {
  const grossSales = roundMoney(lineTotals.reduce((sum, value) => sum + Number(value || 0), 0));
  const normalizedDiscountRate = Math.max(0, Number(discountRate) || 0);
  const discountAmount = roundMoney(grossSales * normalizedDiscountRate);
  const taxableGross = roundMoney(grossSales - discountAmount);
  const vatAmount = roundMoney(taxableGross * (vatRate / (1 + vatRate)));
  const netSales = roundMoney(taxableGross - vatAmount);
  const grandTotal = taxableGross;
  const totalQty = lineTotals.length;

  return {
    grossSales,
    discountRate: normalizedDiscountRate,
    discountAmount,
    vatRate,
    vatAmount,
    netSales,
    grandTotal,
    totalQty,
  };
}

async function lookupTerminal(machineName, branchCode) {
  const normalized = normalizeText(machineName);

  if (!normalized) {
    const error = new Error('Terminal name is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedBranchCode = normalizeText(branchCode);
  let query = `SELECT t.*, b.branch_id, b.branch_code, b.branch_name, b.address
     FROM terminals_a t
     INNER JOIN branches b ON b.branch_id = t.branch_id
     WHERE t.machine_name = ?`;
  const params = [normalized];

  if (normalizedBranchCode) {
    query += ' AND b.branch_code = ?';
    params.push(normalizedBranchCode);
  }

  const [rows] = await getPool().query(query, params);

  if (!rows.length) {
    const error = new Error('Terminal not found. Please check terminal name.');
    error.statusCode = 404;
    throw error;
  }

  if (!normalizedBranchCode && rows.length > 1) {
    const error = new Error(
      'Multiple terminals match this name. Provide branch_code to identify the terminal.',
    );
    error.statusCode = 409;
    throw error;
  }

  const terminal = rows[0];

  if (!terminal.is_active) {
    const error = new Error('This terminal is inactive.');
    error.statusCode = 403;
    throw error;
  }

  const branchDisplay = normalizeText(terminal.address) || normalizeText(terminal.branch_name) || '';

  return {
    terminal_name: terminal.machine_name,
    serial_no: terminal.serial_number,
    ptu_no: terminal.ptu_number,
    min_number: terminal.min_number,
    current_or: Number(terminal.current_or) || 1,
    or_start: terminal.or_start,
    or_end: terminal.or_end,
    branch: branchDisplay,
    branch_id: terminal.branch_id,
    branch_code: terminal.branch_code,
    branch_name: terminal.branch_name,
    is_active: Boolean(terminal.is_active),
  };
}

async function lookupProductByBarcode(barcode, user) {
  const branchId = branchIdFromUser(user);
  const normalized = normalizeText(barcode);

  if (!normalized) {
    const error = new Error('Barcode is required.');
    error.statusCode = 400;
    throw error;
  }

  const [products] = await getPool().query(
    `SELECT p.product_id, p.product_barcode, p.product_name, p.category, p.brand, p.product_image_path, p.unit
     FROM products p
     WHERE p.product_barcode = ?
       AND p.branch_id = ?
     LIMIT 1`,
    [normalized, branchId],
  );

  if (!products.length) {
    return null;
  }

  const product = products[0];

  const [batches] = await getPool().query(
    `SELECT id, batch_id, selling_price, cost_price, COALESCE(Qty, 0) AS qty_available,
            ExpiryDate
     FROM product_batches
     WHERE product_barcode = ?
       AND branch_id = ?
       AND COALESCE(Block, 0) = 0
       AND COALESCE(Qty, 0) > 0
     ORDER BY CASE WHEN ExpiryDate IS NULL THEN 1 ELSE 0 END,
              ExpiryDate ASC,
              id ASC
     LIMIT 1`,
    [normalized, branchId],
  );

  if (!batches.length) {
    const error = new Error('Product has no available stock batch.');
    error.statusCode = 409;
    throw error;
  }

  const batch = batches[0];

  return {
    product_id: product.product_id,
    barcode: product.product_barcode,
    name: product.product_name,
    category: product.category,
    brand: product.brand,
    product_image_path: product.product_image_path || null,
    unit: product.unit,
    batch_id: batch.batch_id,
    product_batch_id: batch.id,
    selling_price: Number(batch.selling_price) || 0,
    cost_price: Number(batch.cost_price) || 0,
    qty_available: Number(batch.qty_available) || 0,
  };
}

async function searchProducts(query, user) {
  const branchId = branchIdFromUser(user);
  const normalized = normalizeText(query);
  const isDefaultList = !normalized;
  const resultLimit = isDefaultList ? 15 : 50;

  const [rows] = await getPool().query(
    `SELECT p.product_id, p.product_barcode, p.product_name, p.category, p.brand, p.product_image_path, p.unit,
            (
              SELECT COALESCE(SUM(COALESCE(pb.Qty, 0)), 0)
              FROM product_batches pb
              WHERE pb.product_barcode = p.product_barcode
                AND pb.branch_id = ?
                AND COALESCE(pb.Block, 0) = 0
            ) AS qty_total,
            (
              SELECT pb.selling_price
              FROM product_batches pb
              WHERE pb.product_barcode = p.product_barcode
                AND pb.branch_id = ?
                AND COALESCE(pb.Block, 0) = 0
                AND COALESCE(pb.Qty, 0) > 0
              ORDER BY CASE WHEN pb.ExpiryDate IS NULL THEN 1 ELSE 0 END, pb.ExpiryDate ASC, pb.id ASC
              LIMIT 1
            ) AS selling_price,
            (
              SELECT pb.batch_id
              FROM product_batches pb
              WHERE pb.product_barcode = p.product_barcode
                AND pb.branch_id = ?
                AND COALESCE(pb.Block, 0) = 0
                AND COALESCE(pb.Qty, 0) > 0
              ORDER BY CASE WHEN pb.ExpiryDate IS NULL THEN 1 ELSE 0 END, pb.ExpiryDate ASC, pb.id ASC
              LIMIT 1
            ) AS batch_id
     FROM products p
     WHERE p.branch_id = ?
       AND ${
       isDefaultList
         ? `EXISTS (
              SELECT 1
              FROM product_batches pb
              WHERE pb.product_barcode = p.product_barcode
                AND pb.branch_id = ?
                AND COALESCE(pb.Block, 0) = 0
                AND COALESCE(pb.Qty, 0) > 0
            )`
         : 'p.product_barcode LIKE ? OR p.product_name LIKE ?'
     }
     ORDER BY p.product_name ASC
     LIMIT ?`,
    isDefaultList
      ? [branchId, branchId, branchId, branchId, branchId, resultLimit]
      : [branchId, branchId, branchId, branchId, `%${normalized}%`, `%${normalized}%`, resultLimit],
  );

  const products = rows
    .filter((row) => row.batch_id)
    .map((row) => ({
      product_id: row.product_id,
      barcode: row.product_barcode,
      name: row.product_name,
      category: row.category,
      brand: row.brand,
      product_image_path: row.product_image_path || null,
      unit: row.unit,
      batch_id: row.batch_id,
      selling_price: Number(row.selling_price) || 0,
      qty_total: Number(row.qty_total) || 0,
    }));

  if (products.length === 0) {
    return [];
  }

  const barcodes = products.map((product) => product.barcode);
  const placeholders = barcodes.map(() => '?').join(', ');
  const [batchRows] = await getPool().query(
    `SELECT product_barcode,
            batch_id,
            COALESCE(Qty, 0) AS qty,
            ExpiryDate,
            id
     FROM product_batches
     WHERE product_barcode IN (${placeholders})
       AND branch_id = ?
       AND COALESCE(Block, 0) = 0
       AND COALESCE(Qty, 0) <> 0
     ORDER BY product_barcode ASC,
              CASE WHEN ExpiryDate IS NULL THEN 1 ELSE 0 END,
              ExpiryDate ASC,
              id ASC`,
    [...barcodes, branchId],
  );

  const batchesByBarcode = new Map();
  for (const row of batchRows) {
    const key = normalizeText(row.product_barcode);
    if (!key) {
      continue;
    }
    if (!batchesByBarcode.has(key)) {
      batchesByBarcode.set(key, []);
    }
    batchesByBarcode.get(key).push({
      batch_id: normalizeText(row.batch_id) || '',
      qty: Number(row.qty) || 0,
      expiry_date: row.ExpiryDate || null,
    });
  }

  return products.map((product) => ({
    ...product,
    batches: batchesByBarcode.get(product.barcode) || [],
  }));
}

async function getTerminalRow(machineName, connection, { forUpdate = false, user } = {}) {
  const branchId = branchIdFromUser(user);
  const db = connection || getPool();
  const lockClause = forUpdate && connection ? ' FOR UPDATE' : '';
  const [rows] = await db.query(
    `SELECT ID, machine_name, serial_number, min_number, ptu_number, current_or, or_end, branch_id
     FROM terminals_a
     WHERE machine_name = ?
     LIMIT 1${lockClause}`,
    [machineName],
  );

  if (!rows.length) {
    const error = new Error('Terminal not found.');
    error.statusCode = 404;
    throw error;
  }

  if (Number(rows[0].branch_id) !== branchId) {
    const error = new Error('Terminal does not belong to your branch.');
    error.statusCode = 403;
    throw error;
  }

  return rows[0];
}

async function listActiveSeries(machineName, user) {
  const normalized = normalizeText(machineName);

  if (!normalized) {
    const error = new Error('machine_name is required.');
    error.statusCode = 400;
    throw error;
  }

  branchIdFromUser(user);

  const terminal = await getTerminalRow(normalized, undefined, { user });

  const [rows] = await getPool().query(
    `SELECT ID, full_series_no, machine_id, min_number, created_at, lockbatch, totalsales, vat_amount, grand_total
     FROM sales_series
     WHERE machine_id = ?
       AND min_number = ?
       AND userid = ?
       AND COALESCE(lockbatch, 'N') = 'N'
     ORDER BY ID DESC
     LIMIT 20`,
    [normalized, terminal.min_number, user.userId],
  );

  return rows;
}

async function createSalesSeries(machineName, user) {
  const normalized = normalizeText(machineName);

  if (!normalized) {
    const error = new Error('machine_name is required.');
    error.statusCode = 400;
    throw error;
  }

  const branchId = branchIdFromUser(user);
  const terminal = await getTerminalRow(normalized, undefined, { user });
  const dateCompact = todayCompactDate();
  const prefix = `${normalized}-${dateCompact}-`;

  const [existing] = await getPool().query(
    `SELECT full_series_no
     FROM sales_series
     WHERE full_series_no LIKE ?
     ORDER BY ID DESC
     LIMIT 1`,
    [`${prefix}%`],
  );

  let nextSeq = 1;

  if (existing.length) {
    const last = String(existing[0].full_series_no || '');
    const match = last.match(/-(\d{3})$/);
    if (match) {
      nextSeq = Number(match[1]) + 1;
    }
  }

  const fullSeriesNo = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  const currentOr = Number(terminal.current_or) || 1;

  const [result] = await getPool().query(
    `INSERT INTO sales_series
      (created_at, full_series_no, machine_id, min_number, ptu, seriesno, starting_balance, totalsales, vat_amount, grand_total, userid, username, lockbatch, branch_id)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, 'N', ?)`,
    [
      todayDateString(),
      fullSeriesNo,
      normalized,
      terminal.min_number,
      terminal.ptu_number,
      nextSeq,
      user.userId,
      user.username,
      branchId,
    ],
  );

  return {
    id: result.insertId,
    full_series_no: fullSeriesNo,
    machine_id: normalized,
    next_orsi: currentOr,
    next_orsi_display: String(currentOr).padStart(8, '0'),
  };
}

async function setSalesSeriesStartingBalance(fullSeriesNo, startingBalance, user) {
  const normalizedSeriesNo = normalizeText(fullSeriesNo);
  const parsedStartingBalance = roundMoney(startingBalance);

  if (!normalizedSeriesNo) {
    const error = new Error('A valid sales series number is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(parsedStartingBalance) || parsedStartingBalance < 0) {
    const error = new Error('starting_balance must be a non-negative number.');
    error.statusCode = 400;
    throw error;
  }

  const [result] = await getPool().query(
    `UPDATE sales_series
     SET starting_balance = ?
     WHERE full_series_no = ?
       AND userid = ?
     LIMIT 1`,
    [parsedStartingBalance, normalizedSeriesNo, user.userId],
  );

  if (!result.affectedRows) {
    const error = new Error('Sales series not found for this cashier.');
    error.statusCode = 404;
    throw error;
  }

  return {
    full_series_no: normalizedSeriesNo,
    starting_balance: parsedStartingBalance,
  };
}

async function getSalesSeriesStartingBalance(fullSeriesNo, user) {
  const normalizedSeriesNo = normalizeText(fullSeriesNo);

  if (!normalizedSeriesNo) {
    const error = new Error('A valid sales series number is required.');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await getPool().query(
    `SELECT full_series_no, starting_balance
     FROM sales_series
     WHERE full_series_no = ?
       AND userid = ?
     LIMIT 1`,
    [normalizedSeriesNo, user.userId],
  );

  if (!rows.length) {
    const error = new Error('Sales series not found for this cashier.');
    error.statusCode = 404;
    throw error;
  }

  const startingBalance = rows[0].starting_balance;

  return {
    full_series_no: normalizedSeriesNo,
    starting_balance:
      startingBalance === null || startingBalance === undefined
        ? null
        : roundMoney(startingBalance),
  };
}

function normalizeReportType(reportType) {
  const normalized = String(reportType || '').trim().toUpperCase();
  if (normalized !== 'X' && normalized !== 'Z') {
    const error = new Error('report_type must be X or Z.');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

async function fetchSeriesForCloseRequirements(fullSeriesNo, machineName, user) {
  const normalizedSeriesNo = normalizeText(fullSeriesNo);
  const normalizedMachine = normalizeText(machineName);

  if (!normalizedSeriesNo) {
    const error = new Error('A valid sales series number is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedMachine) {
    const error = new Error('machine_name is required.');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await getPool().query(
    `SELECT ID,
            full_series_no,
            machine_id,
            lockbatch,
            x_report_printed_at,
            x_report_printed_by,
            z_report_printed_at,
            z_report_printed_by
     FROM sales_series
     WHERE full_series_no = ?
       AND machine_id = ?
       AND userid = ?
     LIMIT 1`,
    [normalizedSeriesNo, normalizedMachine, user.userId],
  );

  if (!rows.length) {
    const error = new Error('Sales series not found for this cashier.');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function getSeriesCloseRequirements(fullSeriesNo, machineName, user) {
  const series = await fetchSeriesForCloseRequirements(fullSeriesNo, machineName, user);
  const xPrinted = Boolean(series.x_report_printed_at);
  const zPrinted = Boolean(series.z_report_printed_at);

  return {
    full_series_no: String(series.full_series_no || ''),
    machine_id: String(series.machine_id || ''),
    lockbatch: String(series.lockbatch || 'N').toUpperCase(),
    x_report_printed: xPrinted,
    z_report_printed: zPrinted,
    x_report_printed_at: series.x_report_printed_at || null,
    z_report_printed_at: series.z_report_printed_at || null,
    can_close: xPrinted && zPrinted,
    missing_reports: [!xPrinted ? 'X' : null, !zPrinted ? 'Z' : null].filter(Boolean),
  };
}

async function markReportPrinted(fullSeriesNo, machineName, reportType, user) {
  const normalizedSeriesNo = normalizeText(fullSeriesNo);
  const normalizedMachine = normalizeText(machineName);
  const normalizedReportType = normalizeReportType(reportType);
  await fetchSeriesForCloseRequirements(normalizedSeriesNo, normalizedMachine, user);

  const column = normalizedReportType === 'X' ? 'x_report_printed_at' : 'z_report_printed_at';
  const byColumn = normalizedReportType === 'X' ? 'x_report_printed_by' : 'z_report_printed_by';

  await getPool().query(
    `UPDATE sales_series
     SET ${column} = NOW(),
         ${byColumn} = ?
     WHERE full_series_no = ?
       AND machine_id = ?
       AND userid = ?
     LIMIT 1`,
    [user.username, normalizedSeriesNo, normalizedMachine, user.userId],
  );

  return getSeriesCloseRequirements(normalizedSeriesNo, normalizedMachine, user);
}

async function closeSalesSeries(fullSeriesNo, machineName, user) {
  const normalizedSeriesNo = normalizeText(fullSeriesNo);
  const normalizedMachine = normalizeText(machineName);

  if (!normalizedSeriesNo) {
    const error = new Error('A valid sales series number is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedMachine) {
    const error = new Error('machine_name is required.');
    error.statusCode = 400;
    throw error;
  }

  const requirements = await getSeriesCloseRequirements(normalizedSeriesNo, normalizedMachine, user);

  if (requirements.lockbatch === 'Y') {
    const error = new Error('Sales series is already closed.');
    error.statusCode = 409;
    throw error;
  }

  if (!requirements.can_close) {
    const missing = requirements.missing_reports.join(' and ');
    const error = new Error(
      `Print ${missing} report${requirements.missing_reports.length > 1 ? 's' : ''} for this series before closing.`,
    );
    error.statusCode = 409;
    error.details = {
      full_series_no: requirements.full_series_no,
      missing_reports: requirements.missing_reports,
    };
    throw error;
  }

  await getPool().query(
    `UPDATE sales_series
     SET lockbatch = 'Y',
         totalsales = 0,
         vat_amount = 0,
         grand_total = 0
     WHERE full_series_no = ?
       AND machine_id = ?
       AND userid = ?
     LIMIT 1`,
    [normalizedSeriesNo, normalizedMachine, user.userId],
  );

  return {
    full_series_no: normalizedSeriesNo,
    lockbatch: 'Y',
  };
}

async function getSummary(machineName, seriesNo) {
  const normalizedMachine = normalizeText(machineName);
  const normalizedSeries = normalizeText(seriesNo);

  if (!normalizedMachine) {
    const error = new Error('machine_name is required.');
    error.statusCode = 400;
    throw error;
  }

  const params = [normalizedMachine];
  let seriesClause = '';

  if (normalizedSeries) {
    seriesClause = ' AND sa.sales_series_no = ?';
    params.push(normalizedSeries);
  }

  const [rows] = await getPool().query(
    `SELECT
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.sales_grandtotal ELSE 0 END), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.sales_total_amt ELSE 0 END), 0) AS net_sales,
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.sales_vatable_amount ELSE 0 END), 0) AS vat_amount,
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.total_item_sold ELSE 0 END), 0) AS qty_sold,
        SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN 1 ELSE 0 END) AS transaction_count
     FROM sales_a sa
     WHERE sa.MachineName = ?
       AND DATE(sa.Created_at) = CURDATE()
       ${seriesClause}`,
    params,
  );

  const summary = rows[0] || {};

  return {
    total_sales: roundMoney(summary.total_sales),
    net_sales: roundMoney(summary.net_sales),
    vat_amount: roundMoney(summary.vat_amount),
    qty_sold: Number(summary.qty_sold) || 0,
    transaction_count: Number(summary.transaction_count) || 0,
  };
}

async function resolveBatchForLine(connection, barcode, batchId, qty, branchId) {
  let query = `SELECT id, batch_id, selling_price, COALESCE(Qty, 0) AS qty_available
               FROM product_batches
               WHERE product_barcode = ?
                 AND branch_id = ?
                 AND COALESCE(Block, 0) = 0
                 AND COALESCE(Qty, 0) >= ?`;
  const params = [barcode, branchId, qty];

  if (batchId) {
    query += ' AND batch_id = ?';
    params.push(batchId);
  }

  query += ` ORDER BY CASE WHEN ExpiryDate IS NULL THEN 1 ELSE 0 END, ExpiryDate ASC, id ASC LIMIT 1`;

  const [rows] = await connection.query(query, params);

  if (!rows.length) {
    const error = new Error(`Insufficient stock for barcode ${barcode}.`);
    error.statusCode = 409;
    throw error;
  }

  return rows[0];
}

async function resolveFifoBatchAllocations(connection, barcode, qtyRequired, branchId) {
  const [rows] = await connection.query(
    `SELECT id, batch_id, selling_price, COALESCE(Qty, 0) AS qty_available
     FROM product_batches
     WHERE product_barcode = ?
       AND branch_id = ?
       AND COALESCE(Block, 0) = 0
       AND COALESCE(Qty, 0) > 0
     ORDER BY CASE WHEN ExpiryDate IS NULL THEN 1 ELSE 0 END, ExpiryDate ASC, id ASC`,
    [barcode, branchId],
  );

  let remaining = qtyRequired;
  const allocations = [];

  for (const row of rows) {
    if (remaining <= 0) {
      break;
    }

    const qtyAvailable = Number(row.qty_available) || 0;
    if (qtyAvailable <= 0) {
      continue;
    }

    const qtyAllocated = Math.min(remaining, qtyAvailable);
    allocations.push({
      product_batch_id: row.id,
      batch_id: row.batch_id,
      qty: qtyAllocated,
      price: roundMoney(row.selling_price),
    });
    remaining -= qtyAllocated;
  }

  if (remaining > 0) {
    const error = new Error(INSUFFICIENT_STOCK_MESSAGE);
    error.statusCode = 409;
    throw error;
  }

  return allocations;
}

async function getCartQtyByBatch(connection, userId, barcode, branchId) {
  const [rows] = await connection.query(
    `SELECT BATCHID, COALESCE(SUM(QTY), 0) AS qty_in_cart
     FROM cart
     WHERE USERID = ? AND BARCODE = ? AND branch_id = ?
     GROUP BY BATCHID`,
    [userId, barcode, branchId],
  );

  const cartQtyByBatch = new Map();
  for (const row of rows) {
    cartQtyByBatch.set(normalizeText(row.BATCHID), Number(row.qty_in_cart) || 0);
  }
  return cartQtyByBatch;
}

async function fetchFifoBatches(connection, barcode, branchId) {
  const [rows] = await connection.query(
    `SELECT id, batch_id, selling_price, COALESCE(Qty, 0) AS qty_available
     FROM product_batches
     WHERE product_barcode = ?
       AND branch_id = ?
       AND COALESCE(Block, 0) = 0
       AND COALESCE(Qty, 0) > 0
     ORDER BY CASE WHEN ExpiryDate IS NULL THEN 1 ELSE 0 END, ExpiryDate ASC, id ASC`,
    [barcode, branchId],
  );

  return rows.map((row) => ({
    product_batch_id: row.id,
    batch_id: normalizeText(row.batch_id),
    qty_available: Number(row.qty_available) || 0,
    price: roundMoney(row.selling_price),
  }));
}

async function getBatchAvailableQty(connection, barcode, batchId, branchId) {
  const [rows] = await connection.query(
    `SELECT COALESCE(Qty, 0) AS qty_available
     FROM product_batches
     WHERE product_barcode = ?
       AND batch_id = ?
       AND branch_id = ?
       AND COALESCE(Block, 0) = 0
     LIMIT 1`,
    [barcode, batchId, branchId],
  );

  if (!rows.length) {
    return 0;
  }

  return Number(rows[0].qty_available) || 0;
}

async function findCartRowsForLine(connection, userId, barcode, batchId, branchId) {
  const [rows] = await connection.query(
    `SELECT ID, QTY, PRICE
     FROM cart
     WHERE USERID = ? AND BARCODE = ? AND BATCHID = ? AND branch_id = ?
     ORDER BY ID DESC`,
    [userId, barcode, batchId, branchId],
  );

  return rows;
}

async function upsertCartIncrement(connection, payload) {
  const {
    batchId,
    barcode,
    description,
    brand,
    unit,
    qtyDelta,
    price,
    userId,
    branchId,
  } = payload;

  const existingRows = await findCartRowsForLine(connection, userId, barcode, batchId, branchId);
  const linePrice = roundMoney(price);

  if (existingRows.length) {
    const keepRow = existingRows[0];
    const mergedQty =
      existingRows.reduce((sum, row) => sum + (Number(row.QTY) || 0), 0) + qtyDelta;
    const lineTotal = roundMoney(linePrice * mergedQty);

    await connection.query(
      `UPDATE cart
       SET DESCRIPTION = ?,
           BRAND = ?,
           UNIT = ?,
           QTY = ?,
           PRICE = ?,
           TOTAL = ?
       WHERE ID = ?`,
      [description || barcode, brand || '', unit || '', mergedQty, linePrice, lineTotal, keepRow.ID],
    );

    if (existingRows.length > 1) {
      const duplicateIds = existingRows.slice(1).map((row) => row.ID);
      await connection.query(`DELETE FROM cart WHERE ID IN (?)`, [duplicateIds]);
    }

    return;
  }

  const initialQty = qtyDelta;
  const lineTotal = roundMoney(linePrice * initialQty);

  await connection.query(
    `INSERT INTO cart (BATCHID, BARCODE, DESCRIPTION, BRAND, UNIT, QTY, PRICE, TOTAL, USERID, branch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batchId,
      barcode,
      description || barcode,
      brand || '',
      unit || '',
      initialQty,
      linePrice,
      lineTotal,
      userId,
      branchId,
    ],
  );
}

async function allocateCartQtyIncrement(connection, barcode, qtyToAdd, userId, productMeta, branchId) {
  const batches = await fetchFifoBatches(connection, barcode, branchId);

  if (!batches.length) {
    const error = new Error('Product not found.');
    error.statusCode = 404;
    throw error;
  }

  const cartQtyByBatch = await getCartQtyByBatch(connection, userId, barcode, branchId);
  let remaining = qtyToAdd;
  const touchedBatchIds = [];

  for (const batch of batches) {
    if (remaining <= 0) {
      break;
    }

    const inCart = cartQtyByBatch.get(batch.batch_id) || 0;
    const capacity = batch.qty_available - inCart;

    if (capacity <= 0) {
      continue;
    }

    const allocate = Math.min(remaining, capacity);
    await upsertCartIncrement(connection, {
      batchId: batch.batch_id,
      barcode,
      description: productMeta.description,
      brand: productMeta.brand,
      unit: productMeta.unit,
      qtyDelta: allocate,
      price: batch.price,
      userId,
      branchId,
    });

    cartQtyByBatch.set(batch.batch_id, inCart + allocate);
    touchedBatchIds.push(batch.batch_id);
    remaining -= allocate;
  }

  if (remaining > 0) {
    const error = new Error(INSUFFICIENT_STOCK_MESSAGE);
    error.statusCode = 409;
    throw error;
  }

  return touchedBatchIds;
}

async function fetchCartLinesForCheckout(connection, user) {
  const branchId = branchIdFromUser(user);
  const [rows] = await connection.query(
    `SELECT c.BATCHID, c.BARCODE, c.DESCRIPTION, c.BRAND, c.UNIT, c.QTY, c.PRICE, c.TOTAL
     FROM cart c
     WHERE c.USERID = ? AND c.branch_id = ?
     ORDER BY c.ID ASC`,
    [user.userId, branchId],
  );

  return rows.map((row) => ({
    barcode: row.BARCODE,
    batch_id: row.BATCHID,
    description: row.DESCRIPTION,
    brand: row.BRAND,
    unit: row.UNIT,
    category: '',
    qty: Math.max(1, Number(row.QTY) || 1),
    price: roundMoney(row.PRICE),
    total: roundMoney(row.TOTAL),
  }));
}

async function checkout(payload, user) {
  const machineName = normalizeText(payload.machine_name);
  const salesSeriesNo = normalizeText(payload.sales_series_no);
  const paymentMethod = normalizeText(payload.payment_method) || 'CASH PAYMENT';
  const paymentRefNo = normalizeText(payload.payment_ref_no) || 'N/A';
  const amtTendered = roundMoney(payload.amt_tendered ?? 0);
  const discountRate = Number(payload.discount_rate) || 0;

  if (!machineName || !salesSeriesNo) {
    const error = new Error('machine_name and sales_series_no are required.');
    error.statusCode = 400;
    throw error;
  }

  const branchId = branchIdFromUser(user);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const terminal = await getTerminalRow(machineName, connection, { forUpdate: true, user });
    const currentOr = Number(terminal.current_or) || 1;
    const orEnd = Number(terminal.or_end);

    if (orEnd && currentOr > orEnd) {
      const error = new Error('Official receipt range exceeded for this terminal.');
      error.statusCode = 409;
      throw error;
    }

    const [seriesRows] = await connection.query(
      `SELECT ID, lockbatch
       FROM sales_series
       WHERE full_series_no = ?
         AND machine_id = ?
         AND min_number = ?
       LIMIT 1`,
      [salesSeriesNo, machineName, terminal.min_number],
    );

    if (!seriesRows.length || String(seriesRows[0].lockbatch || 'N').toUpperCase() === 'Y') {
      const error = new Error('Sales series is not available for checkout.');
      error.statusCode = 409;
      throw error;
    }

    const cartLines = await fetchCartLinesForCheckout(connection, user);

    if (!cartLines.length) {
      const error = new Error('Cart is empty. Add items before checkout.');
      error.statusCode = 400;
      throw error;
    }

    const vatRate = await getVatRate(branchId);
    const resolvedLines = [];

    for (const line of cartLines) {
      const barcode = normalizeText(line.barcode);
      const qty = Math.max(1, Number(line.qty) || 1);
      const batch = await resolveBatchForLine(
        connection,
        barcode,
        normalizeText(line.batch_id),
        qty,
        branchId,
      );
      const price = roundMoney(line.price ?? batch.selling_price);
      const total = roundMoney(price * qty);

      const [productRows] = await connection.query(
        `SELECT product_name, category, brand, unit FROM products WHERE product_barcode = ? AND branch_id = ? LIMIT 1`,
        [barcode, branchId],
      );

      resolvedLines.push({
        barcode,
        batch_id: batch.batch_id,
        product_batch_id: batch.id,
        qty,
        price,
        total,
        description: line.description || productRows[0]?.product_name || barcode,
        category: line.category || productRows[0]?.category || '',
        brand: line.brand || productRows[0]?.brand || '',
        unit: line.unit || productRows[0]?.unit || '',
        qty_available: Number(batch.qty_available),
      });
    }

    const totals = computeSaleTotals(
      resolvedLines.map((line) => line.total),
      discountRate,
      vatRate,
    );

    const totalItemSold = resolvedLines.reduce((sum, line) => sum + line.qty, 0);
    const amtChange = paymentMethod.toUpperCase().includes('CASH')
      ? roundMoney(Math.max(0, amtTendered - totals.grandTotal))
      : 0;

    await connection.query(
      `INSERT INTO sales_a
        (Created_at, sales_series_no, MachineName, PTU, ORSI, sales_amt, discountrate, discount_amount,
         sales_vatable_amount, sales_vat_rate, sales_total_amt, sales_grandtotal, amt_tendered, amt_change,
         payment_method, payment_ref_no, total_item_sold, userid, username, VOIDED, VOID_REASON, branch_id)
       VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', 'N/A', ?)`,
      [
        salesSeriesNo,
        machineName,
        terminal.ptu_number,
        currentOr,
        totals.grossSales,
        totals.discountRate,
        totals.discountAmount,
        totals.vatAmount,
        totals.vatRate,
        totals.netSales,
        totals.grandTotal,
        amtTendered,
        amtChange,
        paymentMethod,
        paymentRefNo,
        totalItemSold,
        user.userId,
        user.username,
        branchId,
      ],
    );

    for (const line of resolvedLines) {
      await connection.query(
        `INSERT INTO sales_b
          (DATECREATED, sales_series_no, ORSI, CATEGORY, BATCHID, BARCODE, DESCRIPTION, BRAND, UNIT, QTY, PRICE, TOTAL, VOIDED, branch_id)
         VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', ?)`,
        [
          salesSeriesNo,
          currentOr,
          line.category,
          line.batch_id,
          line.barcode,
          line.description,
          line.brand,
          line.unit,
          line.qty,
          line.price,
          line.total,
          branchId,
        ],
      );

      await connection.query(
        `UPDATE product_batches
         SET quantity_remaining = GREATEST(0, COALESCE(quantity_remaining, Qty, 0) - ?),
             Qty = GREATEST(0, COALESCE(Qty, 0) - ?)
         WHERE product_barcode = ? AND batch_id = ? AND branch_id = ?`,
        [line.qty, line.qty, line.barcode, line.batch_id, branchId],
      );
    }

    await connection.query(
      `UPDATE sales_series
       SET totalsales = COALESCE(totalsales, 0) + ?,
           vat_amount = COALESCE(vat_amount, 0) + ?,
           grand_total = COALESCE(grand_total, 0) + ?,
           x_report_printed_at = NULL,
           x_report_printed_by = NULL,
           z_report_printed_at = NULL,
           z_report_printed_by = NULL
       WHERE full_series_no = ?`,
      [totals.grandTotal, totals.vatAmount, totals.grandTotal, salesSeriesNo],
    );

    const nextOr = currentOr + 1;
    await connection.query('UPDATE terminals_a SET current_or = ? WHERE ID = ?', [nextOr, terminal.ID]);

    await connection.query(`DELETE FROM cart WHERE USERID = ? AND branch_id = ?`, [user.userId, branchId]);

    await connection.commit();

    return {
      orsi: currentOr,
      orsi_display: String(currentOr).padStart(8, '0'),
      next_orsi: nextOr,
      next_orsi_display: String(nextOr).padStart(8, '0'),
      totals: {
        grossSales: totals.grossSales,
        discountRate: totals.discountRate,
        discountAmount: totals.discountAmount,
        vatRate: totals.vatRate,
        vatAmount: totals.vatAmount,
        netSales: totals.netSales,
        grandTotal: totals.grandTotal,
        itemQtyTotal: totalItemSold,
      },
      amt_tendered: amtTendered,
      amt_change: amtChange,
      payment_method: paymentMethod,
      payment_ref_no: paymentRefNo,
      lines: resolvedLines.map((line) => ({
        barcode: line.barcode,
        batch_id: line.batch_id,
        description: line.description,
        brand: line.brand,
        unit: line.unit,
        category: line.category,
        qty: line.qty,
        price: line.price,
        total: line.total,
      })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function formatOrsiDisplay(value) {
  const numeric = Number(value) || 0;
  return String(numeric).padStart(8, '0');
}

async function buildReportPayload(machineName, reportType, user) {
  const normalized = normalizeText(machineName);

  if (!normalized) {
    const error = new Error('machine_name is required.');
    error.statusCode = 400;
    throw error;
  }

  const branchId = branchIdFromUser(user);
  const vatRate = await getVatRate(branchId);

  const [seriesRows] = await getPool().query(
    `SELECT COALESCE(SUM(COALESCE(ss.starting_balance, 0)), 0) AS starting_balance
     FROM sales_series ss
     WHERE ss.machine_id = ?
       AND DATE(ss.created_at) = CURDATE()`,
    [normalized],
  );

  const startingBalance = roundMoney(seriesRows[0]?.starting_balance ?? 0);

  const [rows] = await getPool().query(
    `SELECT
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.sales_amt ELSE 0 END), 0) AS gross_sales,
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.discount_amount ELSE 0 END), 0) AS discount_amount,
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.sales_total_amt ELSE 0 END), 0) AS net_sales_vat_excl,
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.sales_vatable_amount ELSE 0 END), 0) AS vat_amount,
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.sales_grandtotal ELSE 0 END), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.total_item_sold ELSE 0 END), 0) AS qty_sold,
        SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'Y' THEN 1 ELSE 0 END) AS cancelled_count,
        MIN(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.ORSI END) AS start_orsi,
        MAX(CASE WHEN COALESCE(sa.VOIDED, 'N') = 'N' THEN sa.ORSI END) AS last_orsi,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(sa.VOIDED, 'N') = 'N'
              AND UPPER(COALESCE(sa.payment_method, '')) LIKE '%CASH%'
            THEN sa.sales_grandtotal
            ELSE 0
          END
        ), 0) AS payment_cash,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(sa.VOIDED, 'N') = 'N'
              AND UPPER(COALESCE(sa.payment_method, '')) LIKE '%CARD%'
            THEN sa.sales_grandtotal
            ELSE 0
          END
        ), 0) AS payment_card,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(sa.VOIDED, 'N') = 'N'
              AND (
                UPPER(COALESCE(sa.payment_method, '')) LIKE '%E-WALLET%'
                OR UPPER(COALESCE(sa.payment_method, '')) LIKE '%EWALLET%'
                OR (
                  UPPER(COALESCE(sa.payment_method, '')) NOT LIKE '%CASH%'
                  AND UPPER(COALESCE(sa.payment_method, '')) NOT LIKE '%CARD%'
                )
              )
            THEN sa.sales_grandtotal
            ELSE 0
          END
        ), 0) AS payment_ewallet,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(sa.VOIDED, 'N') = 'N'
              AND UPPER(COALESCE(sa.payment_method, '')) LIKE '%CASH%'
            THEN sa.sales_grandtotal
            ELSE 0
          END
        ), 0) AS cash_in_drawer
     FROM sales_a sa
     WHERE sa.MachineName = ?
       AND DATE(sa.Created_at) = CURDATE()`,
    [normalized],
  );

  const summary = rows[0] || {};
  const totalSales = roundMoney(summary.total_sales);
  const paymentCash = roundMoney(summary.payment_cash);
  const paymentCard = roundMoney(summary.payment_card);
  const paymentEwallet = roundMoney(summary.payment_ewallet);
  const transactionCount = Number(summary.completed_count) || 0;
  const cashSales = roundMoney(summary.cash_in_drawer ?? 0);
  const cashToRemit = roundMoney(startingBalance + paymentCash);
  const referenceTotal = roundMoney(startingBalance + paymentCash + paymentCard + paymentEwallet);

  return {
    report_type: reportType,
    machine_name: normalized,
    generated_at: new Date().toISOString(),
    cashier_name: user?.fullName || user?.username || '',
    gross_sales: roundMoney(summary.gross_sales),
    discount_amount: roundMoney(summary.discount_amount),
    net_sales_vat_excl: roundMoney(summary.net_sales_vat_excl),
    net_sales: roundMoney(summary.net_sales_vat_excl),
    vat_amount: roundMoney(summary.vat_amount),
    total_sales: totalSales,
    vat_rate: vatRate,
    qty_sold: Number(summary.qty_sold) || 0,
    transaction_count: transactionCount,
    completed_count: transactionCount,
    cancelled_count: Number(summary.cancelled_count) || 0,
    start_orsi: summary.start_orsi != null ? formatOrsiDisplay(summary.start_orsi) : '00000000',
    last_orsi: summary.last_orsi != null ? formatOrsiDisplay(summary.last_orsi) : '00000000',
    payment_cash: paymentCash,
    payment_card: paymentCard,
    payment_ewallet: paymentEwallet,
    total_payments: totalSales,
    starting_balance: startingBalance,
    cash_in_drawer: cashSales,
    cash_to_remit: cashToRemit,
    reference_total: referenceTotal,
    drawer_total: cashToRemit,
  };
}

async function getXReport(machineName, user) {
  return buildReportPayload(machineName, 'X', user);
}

async function runZReport(machineName, user) {
  const normalized = normalizeText(machineName);

  if (!normalized) {
    const error = new Error('machine_name is required.');
    error.statusCode = 400;
    throw error;
  }

  const payload = await buildReportPayload(normalized, 'Z', user);

  return {
    ...payload,
    locked_by: user.username,
  };
}

async function upsertCartLine(line, user) {
  const branchId = branchIdFromUser(user);
  const batchId = normalizeText(line.batch_id);
  const barcode = normalizeText(line.barcode);
  const description = normalizeText(line.description);
  const brand = normalizeText(line.brand);
  const unit = normalizeText(line.unit);

  const qty = Number(line.qty ?? 0);
  const price = Number(line.price ?? 0);
  const total = Number(line.total ?? qty * price);

  if (!batchId || !barcode) {
    const error = new Error('batch_id and barcode are required.');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    const error = new Error('qty must be a positive number.');
    error.statusCode = 400;
    throw error;
  }

  const safePrice = roundMoney(price);
  const safeQty = qty;
  const safeTotal = roundMoney(total);

  const pool = getPool();
  const batchAvailable = await getBatchAvailableQty(pool, barcode, batchId, branchId);

  if (batchAvailable <= 0) {
    const error = new Error(`Batch ${batchId} is not available for barcode ${barcode}.`);
    error.statusCode = 409;
    throw error;
  }

  if (safeQty > batchAvailable) {
    const error = new Error(INSUFFICIENT_STOCK_MESSAGE);
    error.statusCode = 409;
    throw error;
  }

  const [stockRows] = await pool.query(
    `SELECT selling_price
     FROM product_batches
     WHERE product_barcode = ?
       AND batch_id = ?
       AND branch_id = ?
       AND COALESCE(Block, 0) = 0
     LIMIT 1`,
    [barcode, batchId, branchId],
  );

  if (!stockRows.length) {
    const error = new Error(`Batch ${batchId} is not available for barcode ${barcode}.`);
    error.statusCode = 409;
    throw error;
  }

  const resolvedPrice = roundMoney(stockRows[0].selling_price);
  const linePrice = safePrice > 0 ? safePrice : resolvedPrice;
  const lineTotal = roundMoney(linePrice * safeQty);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existingRows = await findCartRowsForLine(connection, user.userId, barcode, batchId, branchId);
    let lineId = null;

    if (existingRows.length) {
      lineId = existingRows[0].ID;
      await connection.query(
        `UPDATE cart
         SET DESCRIPTION = ?,
             BRAND = ?,
             UNIT = ?,
             QTY = ?,
             PRICE = ?,
             TOTAL = ?
         WHERE ID = ?`,
        [description || barcode, brand || '', unit || '', safeQty, linePrice, lineTotal, lineId],
      );

      if (existingRows.length > 1) {
        const duplicateIds = existingRows.slice(1).map((row) => row.ID);
        await connection.query(`DELETE FROM cart WHERE ID IN (?)`, [duplicateIds]);
      }
    } else {
      const [result] = await connection.query(
        `INSERT INTO cart (BATCHID, BARCODE, DESCRIPTION, BRAND, UNIT, QTY, PRICE, TOTAL, USERID, branch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchId, barcode, description || barcode, brand || '', unit || '', safeQty, linePrice, lineTotal, user.userId, branchId],
      );
      lineId = result.insertId;
    }

    await connection.commit();

    return {
      ok: true,
      id: lineId,
      batch_id: batchId,
      barcode,
      qty: safeQty,
      price: linePrice,
      total: lineTotal,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function addToCartFifo(line, user) {
  const branchId = branchIdFromUser(user);
  const barcode = normalizeText(line.barcode);
  const qty = Number(line.qty ?? 0);

  if (!barcode) {
    const error = new Error('barcode is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    const error = new Error('qty must be a positive number.');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [productRows] = await connection.query(
      `SELECT product_name, brand, unit, product_image_path
       FROM products
       WHERE product_barcode = ?
         AND branch_id = ?
       LIMIT 1`,
      [barcode, branchId],
    );

    if (!productRows.length) {
      const error = new Error('Product not found.');
      error.statusCode = 404;
      throw error;
    }

    const product = productRows[0];
    const productMeta = {
      description: normalizeText(product.product_name) || barcode,
      brand: normalizeText(product.brand) || '',
      unit: normalizeText(product.unit) || '',
    };

    const batchIds = await allocateCartQtyIncrement(
      connection,
      barcode,
      qty,
      user.userId,
      productMeta,
      branchId,
    );

    let rows;
    if (batchIds.length) {
      const placeholders = batchIds.map(() => '?').join(', ');
      const [cartRows] = await connection.query(
        `SELECT ID, BATCHID, BARCODE, DESCRIPTION, BRAND, UNIT, QTY, PRICE, TOTAL
         FROM cart
         WHERE USERID = ?
           AND branch_id = ?
           AND BARCODE = ?
           AND BATCHID IN (${placeholders})`,
        [user.userId, branchId, barcode, ...batchIds],
      );
      rows = cartRows;
    } else {
      rows = [];
    }

    await connection.commit();

    return {
      ok: true,
      barcode,
      product_image_path: product.product_image_path || null,
      lines: rows.map((row) => ({
        id: row.ID,
        batch_id: row.BATCHID,
        barcode: row.BARCODE,
        description: row.DESCRIPTION,
        brand: row.BRAND,
        unit: row.UNIT,
        qty: Number(row.QTY) || 0,
        price: Number(row.PRICE) || 0,
        total: Number(row.TOTAL) || 0,
      })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listCartLines(user) {
  const branchId = branchIdFromUser(user);
  const [rows] = await getPool().query(
    `SELECT c.ID, c.BATCHID, c.BARCODE, c.DESCRIPTION, c.BRAND, c.UNIT, c.QTY, c.PRICE, c.TOTAL, p.product_image_path
     FROM cart c
     LEFT JOIN products p ON p.product_barcode = c.BARCODE AND p.branch_id = c.branch_id
     WHERE c.USERID = ? AND c.branch_id = ?
     ORDER BY c.ID ASC`,
    [user.userId, branchId],
  );

  return rows.map((row) => ({
    id: row.ID,
    batch_id: row.BATCHID,
    barcode: row.BARCODE,
    description: row.DESCRIPTION,
    brand: row.BRAND,
    unit: row.UNIT,
    qty: Number(row.QTY) || 0,
    price: Number(row.PRICE) || 0,
    total: Number(row.TOTAL) || 0,
    product_image_path: row.product_image_path || null,
  }));
}

async function removeCartLine(line, user) {
  const branchId = branchIdFromUser(user);
  const batchId = normalizeText(line.batch_id);
  const barcode = normalizeText(line.barcode);

  if (!batchId || !barcode) {
    const error = new Error('batch_id and barcode are required.');
    error.statusCode = 400;
    throw error;
  }

  const [result] = await getPool().query(
    `DELETE FROM cart WHERE USERID = ? AND branch_id = ? AND BARCODE = ? AND BATCHID = ?`,
    [user.userId, branchId, barcode, batchId],
  );

  return {
    ok: true,
    deleted: result.affectedRows,
  };
}

async function clearCart(user) {
  const branchId = branchIdFromUser(user);
  await getPool().query(`DELETE FROM cart WHERE USERID = ? AND branch_id = ?`, [user.userId, branchId]);
  return { ok: true };
}

function isVoidedFlag(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'Y' || normalized === 'YES' || normalized === '1';
}

function ensureValidOrsi(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error('A valid ORSI is required.');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function ensureVoidReason(reason) {
  const text = normalizeText(reason);

  if (!text || text.length < 3) {
    const error = new Error('void_reason is required (at least 3 characters).');
    error.statusCode = 400;
    throw error;
  }

  return text;
}

function assertSeriesOpen(lockbatch) {
  if (String(lockbatch || '').trim().toUpperCase() === 'Y') {
    const error = new Error('Sales series is closed. Void and cancel are not allowed.');
    error.statusCode = 409;
    throw error;
  }
}

async function loadTransactionContext(connection, orsi, access, { forUpdate = false } = {}) {
  const lockSql = forUpdate ? ' FOR UPDATE' : '';

  const [rows] = await connection.query(
    `SELECT sa.ID,
            sa.Created_at AS created_at,
            sa.sales_series_no,
            sa.MachineName,
            sa.PTU,
            sa.ORSI,
            sa.sales_amt,
            sa.discountrate,
            sa.discount_amount,
            sa.sales_vatable_amount,
            sa.sales_vat_rate,
            sa.sales_total_amt,
            sa.sales_grandtotal,
            sa.amt_tendered,
            sa.amt_change,
            sa.payment_method,
            sa.payment_ref_no,
            sa.total_item_sold,
            sa.customerid,
            sa.userid,
            sa.username,
            sa.VOIDED,
            sa.VOID_REASON,
            ss.lockbatch
     FROM sales_a sa
     INNER JOIN sales_series ss ON ss.full_series_no = sa.sales_series_no
     WHERE sa.ORSI = ?
       AND ss.machine_id = ?
       AND ss.min_number = ?
       AND ss.userid = ?${lockSql}`,
    [orsi, access.machineName, access.minNumber, access.userId],
  );

  if (!rows.length) {
    const error = new Error('Sales transaction not found for this terminal and cashier.');
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function restoreLineInventory(connection, barcode, batchId, qty) {
  const normalizedBarcode = normalizeText(barcode);
  const normalizedBatchId = normalizeText(batchId);
  const normalizedQty = Math.max(0, Number(qty) || 0);

  if (!normalizedBarcode || !normalizedBatchId || normalizedQty <= 0) {
    return;
  }

  await connection.query(
    `UPDATE product_batches
     SET quantity_remaining = COALESCE(quantity_remaining, Qty, 0) + ?,
         Qty = COALESCE(Qty, 0) + ?
     WHERE product_barcode = ? AND batch_id = ?`,
    [normalizedQty, normalizedQty, normalizedBarcode, normalizedBatchId],
  );
}

async function adjustSalesSeriesTotals(connection, seriesNo, grandDelta, vatDelta) {
  await connection.query(
    `UPDATE sales_series
     SET totalsales = GREATEST(0, COALESCE(totalsales, 0) + ?),
         vat_amount = GREATEST(0, COALESCE(vat_amount, 0) + ?),
         grand_total = GREATEST(0, COALESCE(grand_total, 0) + ?)
     WHERE full_series_no = ?`,
    [grandDelta, vatDelta, grandDelta, seriesNo],
  );
}

async function fetchTransactionRowByOrsi(orsi) {
  const [rows] = await getPool().query(
    `SELECT sa.ID,
            sa.Created_at AS created_at,
            sa.sales_series_no,
            sa.MachineName,
            sa.PTU,
            sa.ORSI,
            sa.sales_amt,
            sa.discountrate,
            sa.discount_amount,
            sa.sales_vatable_amount,
            sa.sales_vat_rate,
            sa.sales_total_amt,
            sa.sales_grandtotal,
            sa.amt_tendered,
            sa.amt_change,
            sa.payment_method,
            sa.payment_ref_no,
            sa.total_item_sold,
            sa.customerid,
            sa.userid,
            sa.username,
            sa.VOIDED,
            sa.VOID_REASON,
            (SELECT COUNT(*) FROM sales_b sb WHERE sb.ORSI = sa.ORSI) AS line_item_count
     FROM sales_a sa
     WHERE sa.ORSI = ?
     LIMIT 1`,
    [orsi],
  );

  return rows[0] || null;
}

async function recomputeSalesAFromLines(connection, salesA, activeLines) {
  const lineTotals = activeLines.map((line) => Number(line.TOTAL) || 0);
  const discountRate = Number(salesA.discountrate) || 0;
  const vatRate = Number(salesA.sales_vat_rate) || (await getVatRate(Number(salesA.branch_id) || undefined));
  const totals = computeSaleTotals(lineTotals, discountRate, vatRate);
  const totalItemSold = activeLines.reduce((sum, line) => sum + (Number(line.QTY) || 0), 0);
  const paymentMethod = String(salesA.payment_method || '');
  const amtTendered = Number(salesA.amt_tendered) || 0;
  const amtChange = paymentMethod.toUpperCase().includes('CASH')
    ? roundMoney(Math.max(0, amtTendered - totals.grandTotal))
    : 0;

  await connection.query(
    `UPDATE sales_a
     SET sales_amt = ?,
         discount_amount = ?,
         sales_vatable_amount = ?,
         sales_vat_rate = ?,
         sales_total_amt = ?,
         sales_grandtotal = ?,
         total_item_sold = ?,
         amt_change = ?
     WHERE ORSI = ?`,
    [
      totals.grossSales,
      totals.discountAmount,
      totals.vatAmount,
      totals.vatRate,
      totals.netSales,
      totals.grandTotal,
      totalItemSold,
      amtChange,
      salesA.ORSI,
    ],
  );

  return {
    grossSales: totals.grossSales,
    discountAmount: totals.discountAmount,
    vatAmount: totals.vatAmount,
    netSales: totals.netSales,
    grandTotal: totals.grandTotal,
    totalItemSold,
    amtChange,
  };
}

async function voidPosTransactionInConnection(connection, salesA, reason) {
  const normalizedOrsi = Number(salesA.ORSI);

  if (isVoidedFlag(salesA.VOIDED)) {
    const error = new Error('Transaction is already voided.');
    error.statusCode = 409;
    throw error;
  }

  const [itemRows] = await connection.query(`SELECT * FROM sales_b WHERE ORSI = ? FOR UPDATE`, [normalizedOrsi]);

  for (const item of itemRows) {
    if (isVoidedFlag(item.VOIDED)) {
      continue;
    }

    await connection.query(`UPDATE sales_b SET VOIDED = 'Y' WHERE ID = ?`, [item.ID]);
    await restoreLineInventory(connection, item.BARCODE, item.BATCHID, item.QTY);
  }

  await connection.query(`UPDATE sales_a SET VOIDED = 'Y', VOID_REASON = ? WHERE ORSI = ?`, [reason, normalizedOrsi]);

  const grandDelta = -roundMoney(Number(salesA.sales_grandtotal) || 0);
  const vatDelta = -roundMoney(Number(salesA.sales_vatable_amount) || 0);
  await adjustSalesSeriesTotals(connection, salesA.sales_series_no, grandDelta, vatDelta);
}

async function voidPosTransaction(orsi, { voidReason, machineName, minNumber, userId }) {
  const normalizedOrsi = ensureValidOrsi(orsi);
  const reason = ensureVoidReason(voidReason);
  const access = { machineName, userId, minNumber };

  await assertTransactionAccess(normalizedOrsi, access);

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const salesA = await loadTransactionContext(connection, normalizedOrsi, access, { forUpdate: true });
    assertSeriesOpen(salesA.lockbatch);
    await voidPosTransactionInConnection(connection, salesA, reason);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const transaction = await fetchTransactionRowByOrsi(normalizedOrsi);
  const items = await listSalesItemsByTransaction(normalizedOrsi);

  return { transaction, items };
}

async function voidPosTransactionItem(orsi, itemId, { voidReason, machineName, minNumber, userId }) {
  const normalizedOrsi = ensureValidOrsi(orsi);
  const normalizedItemId = Number(itemId);
  const reason = ensureVoidReason(voidReason);
  const access = { machineName, userId, minNumber };

  if (!Number.isInteger(normalizedItemId) || normalizedItemId <= 0) {
    const error = new Error('A valid line item id is required.');
    error.statusCode = 400;
    throw error;
  }

  await assertTransactionAccess(normalizedOrsi, access);

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const salesA = await loadTransactionContext(connection, normalizedOrsi, access, { forUpdate: true });
    assertSeriesOpen(salesA.lockbatch);

    if (isVoidedFlag(salesA.VOIDED)) {
      const error = new Error('Transaction is already voided.');
      error.statusCode = 409;
      throw error;
    }

    const [itemRows] = await connection.query(
      `SELECT * FROM sales_b WHERE ID = ? AND ORSI = ? FOR UPDATE`,
      [normalizedItemId, normalizedOrsi],
    );

    if (!itemRows.length) {
      const error = new Error('Line item not found for this transaction.');
      error.statusCode = 404;
      throw error;
    }

    const targetItem = itemRows[0];

    if (isVoidedFlag(targetItem.VOIDED)) {
      const error = new Error('Line item is already voided.');
      error.statusCode = 409;
      throw error;
    }

    const oldGrand = roundMoney(Number(salesA.sales_grandtotal) || 0);
    const oldVat = roundMoney(Number(salesA.sales_vatable_amount) || 0);

    await connection.query(`UPDATE sales_b SET VOIDED = 'Y' WHERE ID = ?`, [normalizedItemId]);
    await restoreLineInventory(connection, targetItem.BARCODE, targetItem.BATCHID, targetItem.QTY);

    const [remainingRows] = await connection.query(
      `SELECT * FROM sales_b WHERE ORSI = ? AND UPPER(TRIM(COALESCE(VOIDED, 'N'))) NOT IN ('Y', 'YES', '1')`,
      [normalizedOrsi],
    );

    if (!remainingRows.length) {
      await voidPosTransactionInConnection(connection, salesA, reason);
    } else {
      const recomputed = await recomputeSalesAFromLines(connection, salesA, remainingRows);
      const grandDelta = roundMoney(recomputed.grandTotal - oldGrand);
      const vatDelta = roundMoney(recomputed.vatAmount - oldVat);
      await adjustSalesSeriesTotals(connection, salesA.sales_series_no, grandDelta, vatDelta);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const transaction = await fetchTransactionRowByOrsi(normalizedOrsi);
  const items = await listSalesItemsByTransaction(normalizedOrsi);

  return { transaction, items };
}

function mapSalesBRowToCheckoutLine(row) {
  return {
    barcode: row.BARCODE || '',
    batch_id: row.BATCHID || '',
    description: row.DESCRIPTION || '',
    category: row.CATEGORY || '',
    brand: row.BRAND || '',
    unit: row.UNIT || '',
    qty: Number(row.QTY) || 0,
    price: Number(row.PRICE) || 0,
    total: Number(row.TOTAL) || 0,
  };
}

async function getPosTransactionReceipt(orsi, accessContext) {
  const normalizedOrsi = await assertTransactionAccess(orsi, accessContext);
  const header = await fetchTransactionRowByOrsi(normalizedOrsi);

  if (!header) {
    const error = new Error('Sales transaction not found.');
    error.statusCode = 404;
    throw error;
  }

  const allItems = await listSalesItemsByTransaction(normalizedOrsi);
  const activeItems = allItems.filter((item) => !isVoidedFlag(item.VOIDED));
  const lines = activeItems.map(mapSalesBRowToCheckoutLine);

  return {
    sales_series_no: header.sales_series_no,
    checkout: {
      orsi: normalizedOrsi,
      orsi_display: formatOrsiDisplay(normalizedOrsi),
      next_orsi: normalizedOrsi + 1,
      next_orsi_display: formatOrsiDisplay(normalizedOrsi + 1),
      totals: {
        grossSales: roundMoney(Number(header.sales_amt) || 0),
        discountRate: Number(header.discountrate) || 0,
        discountAmount: roundMoney(Number(header.discount_amount) || 0),
        vatRate: Number(header.sales_vat_rate) || DEFAULT_VAT_RATE,
        vatAmount: roundMoney(Number(header.sales_vatable_amount) || 0),
        netSales: roundMoney(Number(header.sales_total_amt) || 0),
        grandTotal: roundMoney(Number(header.sales_grandtotal) || 0),
        itemQtyTotal: Number(header.total_item_sold) || 0,
      },
      amt_tendered: roundMoney(Number(header.amt_tendered) || 0),
      amt_change: roundMoney(Number(header.amt_change) || 0),
      payment_method: header.payment_method || '',
      payment_ref_no: header.payment_ref_no || 'N/A',
      lines,
    },
  };
}

module.exports = {
  lookupTerminal,
  lookupProductByBarcode,
  searchProducts,
  listActiveSeries,
  createSalesSeries,
  setSalesSeriesStartingBalance,
  getSalesSeriesStartingBalance,
  closeSalesSeries,
  getSeriesCloseRequirements,
  markReportPrinted,
  getSummary,
  computeSaleTotals,
  checkout,
  getXReport,
  runZReport,
  addToCartFifo,
  listCartLines,
  upsertCartLine,
  removeCartLine,
  clearCart,
  voidPosTransaction,
  voidPosTransactionItem,
  getPosTransactionReceipt,
};
