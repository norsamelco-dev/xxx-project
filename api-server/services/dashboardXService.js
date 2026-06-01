const { getPool } = require('../db');
const { ensureDamageReportTables } = require('./damageReportService');

const DAMAGE_REPORTS_TABLE = 'damage_reports';
const DAMAGE_REPORT_ITEMS_TABLE = 'damage_report_items';
const DAMAGE_SYNC_LOGS_TABLE = 'damage_report_sync_logs';
const DAMAGE_SYNC_LOG_ITEMS_TABLE = 'damage_report_sync_log_items';

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function ensureValidDate(value, fieldName) {
  if (!value) {
    return null;
  }

  const dateText = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format.`);
    error.statusCode = 400;
    throw error;
  }

  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} is not a valid date.`);
    error.statusCode = 400;
    throw error;
  }

  return dateText;
}

function toDateOnlyText(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateText, count) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + count);
  return toDateOnlyText(date);
}

function getRangeBounds(startDate, endDate) {
  const normalizedStartDate = ensureValidDate(startDate, 'start_date') || toDateOnlyText(new Date());
  const normalizedEndDate = ensureValidDate(endDate, 'end_date') || normalizedStartDate;

  if (normalizedStartDate > normalizedEndDate) {
    const error = new Error('start_date cannot be later than end_date.');
    error.statusCode = 400;
    throw error;
  }

  return {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    endExclusive: addDays(normalizedEndDate, 1),
  };
}

function normalizeGroupBy(groupBy) {
  const normalized = String(groupBy || 'daily').trim().toLowerCase();
  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly' || normalized === 'yearly') {
    return normalized;
  }

  return 'daily';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function voidedFilterSql(columnName) {
  return `UPPER(TRIM(COALESCE(${columnName}, 'N'))) <> 'Y'`;
}

async function getOverviewCards() {
  const pool = getPool();

  const [salesRows] = await pool.query(
    `SELECT COALESCE(SUM(CASE
                          WHEN sa.Created_at >= CURDATE()
                           AND sa.Created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                           AND ${voidedFilterSql('sa.VOIDED')}
                          THEN COALESCE(sa.sales_grandtotal, 0)
                          ELSE 0
                        END), 0) AS total_sales_today,
            COALESCE(SUM(CASE
                          WHEN sa.Created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
                           AND sa.Created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                           AND ${voidedFilterSql('sa.VOIDED')}
                          THEN COALESCE(sa.sales_grandtotal, 0)
                          ELSE 0
                        END), 0) AS total_sales_week,
            COALESCE(SUM(CASE
                          WHEN sa.Created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                           AND sa.Created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                           AND ${voidedFilterSql('sa.VOIDED')}
                          THEN COALESCE(sa.sales_grandtotal, 0)
                          ELSE 0
                        END), 0) AS total_sales_month,
            COALESCE(SUM(CASE WHEN ${voidedFilterSql('sa.VOIDED')} THEN 1 ELSE 0 END), 0) AS total_transactions
     FROM sales_a sa`,
  );

  const [activeRows] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM terminals_a WHERE COALESCE(is_active, 0) = 1) AS active_machines,
            (SELECT COUNT(*)
             FROM users
             WHERE ACTIVE = 1
                OR ACTIVE = '1'
                OR UPPER(TRIM(COALESCE(ACTIVE, 'N'))) = 'Y') AS active_users`,
  );

  return {
    totalSalesToday: toNumber(salesRows[0]?.total_sales_today),
    totalSalesWeek: toNumber(salesRows[0]?.total_sales_week),
    totalSalesMonth: toNumber(salesRows[0]?.total_sales_month),
    totalTransactions: toNumber(salesRows[0]?.total_transactions),
    activeMachines: toNumber(activeRows[0]?.active_machines),
    activeUsers: toNumber(activeRows[0]?.active_users),
  };
}

async function getSalesTrends(range, groupBy) {
  const pool = getPool();
  const params = [range.startDate, range.endExclusive];

  let groupSelect = "DATE_FORMAT(sa.Created_at, '%Y-%m-%d')";
  let groupOrder = 'DATE(sa.Created_at)';
  let labelAlias = 'period_label';

  if (groupBy === 'weekly') {
    groupSelect = "CONCAT(YEAR(sa.Created_at), '-W', LPAD(WEEK(sa.Created_at, 1), 2, '0'))";
    groupOrder = 'YEAR(sa.Created_at), WEEK(sa.Created_at, 1)';
  } else if (groupBy === 'monthly') {
    groupSelect = "DATE_FORMAT(sa.Created_at, '%Y-%m')";
    groupOrder = "DATE_FORMAT(sa.Created_at, '%Y-%m')";
  } else if (groupBy === 'yearly') {
    groupSelect = 'YEAR(sa.Created_at)';
    groupOrder = 'YEAR(sa.Created_at)';
  }

  const [rows] = await pool.query(
    `SELECT ${groupSelect} AS ${labelAlias},
            COALESCE(SUM(COALESCE(sa.sales_grandtotal, 0)), 0) AS total_sales,
            COUNT(*) AS transaction_count
     FROM sales_a sa
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?
       AND ${voidedFilterSql('sa.VOIDED')}
     GROUP BY ${labelAlias}
     ORDER BY ${groupOrder}`,
    params,
  );

  return rows.map((row) => ({
    period: String(row.period_label),
    totalSales: toNumber(row.total_sales),
    transactions: toNumber(row.transaction_count),
  }));
}

async function getTopProducts(range, limit = 10) {
  const pool = getPool();
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

  const [rows] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(sb.DESCRIPTION), ''), NULLIF(TRIM(p.product_name), ''), NULLIF(TRIM(sb.BARCODE), ''), 'Unknown Product') AS product_name,
            COALESCE(NULLIF(TRIM(sb.CATEGORY), ''), NULLIF(TRIM(p.category), ''), 'Uncategorized') AS category,
            COALESCE(SUM(COALESCE(sb.QTY, 0)), 0) AS total_qty,
            COALESCE(SUM(COALESCE(sb.TOTAL, 0)), 0) AS total_sales
     FROM sales_b sb
     INNER JOIN sales_a sa ON sa.ORSI = sb.ORSI
     LEFT JOIN products p ON p.product_barcode = sb.BARCODE
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?
       AND ${voidedFilterSql('sa.VOIDED')}
       AND ${voidedFilterSql('sb.VOIDED')}
     GROUP BY product_name, category
     ORDER BY total_sales DESC, total_qty DESC
     LIMIT ?`,
    [range.startDate, range.endExclusive, safeLimit],
  );

  return rows.map((row) => ({
    productName: String(row.product_name),
    category: String(row.category),
    quantity: toNumber(row.total_qty),
    totalSales: toNumber(row.total_sales),
  }));
}

async function getSalesByCategory(range) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(sb.CATEGORY), ''), 'Uncategorized') AS category,
            COALESCE(SUM(COALESCE(sb.TOTAL, 0)), 0) AS total_sales,
            COALESCE(SUM(COALESCE(sb.QTY, 0)), 0) AS total_qty
     FROM sales_b sb
     INNER JOIN sales_a sa ON sa.ORSI = sb.ORSI
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?
       AND ${voidedFilterSql('sa.VOIDED')}
       AND ${voidedFilterSql('sb.VOIDED')}
     GROUP BY category
     ORDER BY total_sales DESC`,
    [range.startDate, range.endExclusive],
  );

  return rows.map((row) => ({
    category: String(row.category),
    totalSales: toNumber(row.total_sales),
    quantity: toNumber(row.total_qty),
  }));
}

async function getPeakHours(range) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT HOUR(sa.Created_at) AS hour_number,
            CONCAT(LPAD(HOUR(sa.Created_at), 2, '0'), ':00') AS hour_label,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(COALESCE(sa.sales_grandtotal, 0)), 0) AS total_sales
     FROM sales_a sa
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?
       AND ${voidedFilterSql('sa.VOIDED')}
     GROUP BY hour_number, hour_label
     ORDER BY hour_number ASC`,
    [range.startDate, range.endExclusive],
  );

  return rows.map((row) => ({
    hour: String(row.hour_label),
    transactions: toNumber(row.transaction_count),
    totalSales: toNumber(row.total_sales),
  }));
}

async function getDiscountsAndVoids(range) {
  const pool = getPool();

  const [discountRows] = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(sa.discount_amount, 0)), 0) AS discounts_total,
            COALESCE(SUM(CASE WHEN COALESCE(sa.discount_amount, 0) > 0 THEN 1 ELSE 0 END), 0) AS discounted_transactions,
            COALESCE(SUM(CASE WHEN ${voidedFilterSql('sa.VOIDED')} THEN 1 ELSE 0 END), 0) AS non_void_transactions,
            COALESCE(SUM(CASE WHEN NOT ${voidedFilterSql('sa.VOIDED')} THEN 1 ELSE 0 END), 0) AS voided_transactions,
            COALESCE(SUM(CASE WHEN NOT ${voidedFilterSql('sa.VOIDED')} THEN COALESCE(sa.sales_grandtotal, 0) ELSE 0 END), 0) AS voided_amount
     FROM sales_a sa
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?`,
    [range.startDate, range.endExclusive],
  );

  const [voidItemRows] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN NOT ${voidedFilterSql('sb.VOIDED')} THEN 1 ELSE 0 END), 0) AS voided_items,
            COALESCE(SUM(CASE WHEN NOT ${voidedFilterSql('sb.VOIDED')} THEN COALESCE(sb.TOTAL, 0) ELSE 0 END), 0) AS voided_items_amount
     FROM sales_b sb
     INNER JOIN sales_a sa ON sa.ORSI = sb.ORSI
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?`,
    [range.startDate, range.endExclusive],
  );

  return {
    discountsTotal: toNumber(discountRows[0]?.discounts_total),
    discountedTransactions: toNumber(discountRows[0]?.discounted_transactions),
    nonVoidedTransactions: toNumber(discountRows[0]?.non_void_transactions),
    voidedTransactions: toNumber(discountRows[0]?.voided_transactions),
    voidedAmount: toNumber(discountRows[0]?.voided_amount),
    voidedItems: toNumber(voidItemRows[0]?.voided_items),
    voidedItemsAmount: toNumber(voidItemRows[0]?.voided_items_amount),
  };
}

async function getPaymentBreakdown(range) {
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(sa.payment_method), ''), 'UNSPECIFIED') AS payment_method,
            CASE
              WHEN UPPER(COALESCE(sa.payment_method, '')) LIKE '%CASH%' THEN 'Cash'
              ELSE 'Non-Cash'
            END AS payment_group,
            COUNT(*) AS transactions,
            COALESCE(SUM(COALESCE(sa.sales_grandtotal, 0)), 0) AS total_sales
     FROM sales_a sa
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?
       AND ${voidedFilterSql('sa.VOIDED')}
     GROUP BY payment_method, payment_group
     ORDER BY total_sales DESC`,
    [range.startDate, range.endExclusive],
  );

  const grouped = rows.reduce(
    (acc, row) => {
      const key = String(row.payment_group || 'Non-Cash');
      acc[key] = (acc[key] || 0) + toNumber(row.total_sales);
      return acc;
    },
    {},
  );

  return {
    byMethod: rows.map((row) => ({
      paymentMethod: String(row.payment_method),
      paymentGroup: String(row.payment_group),
      transactions: toNumber(row.transactions),
      totalSales: toNumber(row.total_sales),
    })),
    byGroup: {
      cash: toNumber(grouped.Cash),
      nonCash: toNumber(grouped['Non-Cash']),
    },
  };
}

async function getInventoryAlertCounts() {
  const pool = getPool();

  const [lowStockRows] = await pool.query(
    `SELECT COUNT(*) AS low_stock_count
     FROM products p
     LEFT JOIN (
       SELECT pb.product_barcode,
              COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS total_qty
       FROM product_batches pb
       GROUP BY pb.product_barcode
     ) stock ON stock.product_barcode = p.product_barcode
     WHERE COALESCE(stock.total_qty, 0) <= COALESCE(p.rop, 0)
       AND COALESCE(stock.total_qty, 0) > 0`,
  );

  const [outOfStockRows] = await pool.query(
    `SELECT COUNT(*) AS out_of_stock_count
     FROM products p
     LEFT JOIN (
       SELECT pb.product_barcode,
              COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS total_qty
       FROM product_batches pb
       GROUP BY pb.product_barcode
     ) stock ON stock.product_barcode = p.product_barcode
     WHERE COALESCE(stock.total_qty, 0) <= 0`,
  );

  const [nearExpiryRows] = await pool.query(
    `SELECT COUNT(*) AS near_expiry_count
     FROM product_batches pb
     WHERE pb.ExpiryDate IS NOT NULL
       AND pb.ExpiryDate > '2000-01-01'
       AND pb.ExpiryDate >= CURDATE()
       AND pb.ExpiryDate <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
  );

  return {
    lowStockAlerts: toNumber(lowStockRows[0]?.low_stock_count),
    outOfStockItems: toNumber(outOfStockRows[0]?.out_of_stock_count),
    nearExpiryItems: toNumber(nearExpiryRows[0]?.near_expiry_count),
  };
}

function sliceTrendPoints(trends, limit = 14) {
  if (!Array.isArray(trends) || !trends.length) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 14, 1), 100);
  return trends.slice(-safeLimit);
}

/** Rolling 30-day window ending today (inclusive). */
function getLastMonthDailyRange() {
  const endDate = toDateOnlyText(new Date());
  const startDate = addDays(endDate, -29);
  return getRangeBounds(startDate, endDate);
}

function fillDailyTrendGaps(trends, range) {
  const trendMap = new Map(
    (Array.isArray(trends) ? trends : []).map((row) => [String(row.period), row]),
  );
  const points = [];
  let cursor = range.startDate;

  while (cursor <= range.endDate) {
    const existing = trendMap.get(cursor);
    points.push(
      existing || {
        period: cursor,
        totalSales: 0,
        transactions: 0,
      },
    );
    cursor = addDays(cursor, 1);
  }

  return points;
}

async function getDailySalesLastMonth() {
  const range = getLastMonthDailyRange();
  const trends = await getSalesTrends(range, 'daily');
  const points = fillDailyTrendGaps(trends, range);

  return {
    start_date: range.startDate,
    end_date: range.endDate,
    points,
  };
}

async function getInventorySummary() {
  const pool = getPool();

  const [productCountRows] = await pool.query(
    `SELECT COUNT(*) AS total_products
     FROM products`,
  );

  const [lowStockRows] = await pool.query(
    `SELECT COUNT(*) AS low_stock_count
     FROM products p
     LEFT JOIN (
       SELECT pb.product_barcode,
              COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS total_qty
       FROM product_batches pb
       GROUP BY pb.product_barcode
     ) stock ON stock.product_barcode = p.product_barcode
     WHERE COALESCE(stock.total_qty, 0) <= COALESCE(p.rop, 0)
       AND COALESCE(stock.total_qty, 0) > 0`,
  );

  const [outOfStockRows] = await pool.query(
    `SELECT COUNT(*) AS out_of_stock_count
     FROM products p
     LEFT JOIN (
       SELECT pb.product_barcode,
              COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS total_qty
       FROM product_batches pb
       GROUP BY pb.product_barcode
     ) stock ON stock.product_barcode = p.product_barcode
     WHERE COALESCE(stock.total_qty, 0) <= 0`,
  );

  const [nearExpiryRows] = await pool.query(
    `SELECT COUNT(*) AS near_expiry_count
     FROM product_batches pb
     WHERE pb.ExpiryDate IS NOT NULL
       AND pb.ExpiryDate > '2000-01-01'
       AND pb.ExpiryDate >= CURDATE()
       AND pb.ExpiryDate <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
  );

  const [movementRows] = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS stock_in_total,
            COALESCE(SUM(COALESCE(pb.quantity_remaining, 0)), 0) AS stock_remaining_total
     FROM product_batches pb`,
  );

  const stockInTotal = toNumber(movementRows[0]?.stock_in_total);
  const stockRemainingTotal = toNumber(movementRows[0]?.stock_remaining_total);

  return {
    totalProducts: toNumber(productCountRows[0]?.total_products),
    lowStockAlerts: toNumber(lowStockRows[0]?.low_stock_count),
    outOfStockItems: toNumber(outOfStockRows[0]?.out_of_stock_count),
    nearExpiryItems: toNumber(nearExpiryRows[0]?.near_expiry_count),
    stockMovement: {
      stockInTotal,
      stockRemainingTotal,
      estimatedStockOut: Math.max(0, stockInTotal - stockRemainingTotal),
    },
    notes: ['Stock movement is estimated from product_batches Qty and quantity_remaining.'],
  };
}

async function getFinancialSummary(range, paymentBreakdown, discountsAndVoids) {
  const pool = getPool();

  const [taxRows] = await pool.query(
    `SELECT COALESCE(SUM(CASE
                          WHEN ${voidedFilterSql('sa.VOIDED')}
                          THEN COALESCE(sa.sales_grandtotal, 0) - COALESCE(sa.sales_total_amt, 0)
                          ELSE 0
                        END), 0) AS tax_collected
     FROM sales_a sa
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?`,
    [range.startDate, range.endExclusive],
  );

  const [profitRows] = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(sb.TOTAL, 0)), 0) AS gross_sales,
            COALESCE(SUM(COALESCE(pb.cost_price, 0) * COALESCE(sb.QTY, 0)), 0) AS estimated_cogs
     FROM sales_b sb
     INNER JOIN sales_a sa ON sa.ORSI = sb.ORSI
     LEFT JOIN product_batches pb
       ON pb.batch_id = sb.BATCHID
      AND pb.product_barcode = sb.BARCODE
     WHERE sa.Created_at >= ?
       AND sa.Created_at < ?
       AND ${voidedFilterSql('sa.VOIDED')}
       AND ${voidedFilterSql('sb.VOIDED')}`,
    [range.startDate, range.endExclusive],
  );

  const grossSales = toNumber(profitRows[0]?.gross_sales);
  const estimatedCogs = toNumber(profitRows[0]?.estimated_cogs);
  const estimatedNetProfit = grossSales - estimatedCogs;

  return {
    cashVsNonCash: paymentBreakdown.byGroup,
    refundsAndReturns: {
      estimatedAmount: discountsAndVoids.voidedAmount,
      estimatedTransactions: discountsAndVoids.voidedTransactions,
      note: 'Estimated from VOIDED sales_a transactions (refunds/returns table not available).',
    },
    netProfit: {
      grossSales,
      estimatedCogs,
      estimatedNetProfit,
      note: 'Estimated using product_batches.cost_price matched by batch_id + barcode.',
    },
    taxCollected: toNumber(taxRows[0]?.tax_collected),
  };
}

async function getDamageReportSummary(range) {
  const pool = getPool();
  await ensureDamageReportTables(pool);

  const [reportRows] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN dr.status = 'draft' THEN 1 ELSE 0 END), 0) AS draft_reports_open,
            COALESCE(SUM(CASE
                          WHEN dr.created_at >= ?
                           AND dr.created_at < ?
                          THEN 1
                          ELSE 0
                        END), 0) AS reports_created_in_range,
            COALESCE(SUM(CASE
                          WHEN dr.status = 'synced'
                           AND dr.synced_at >= ?
                           AND dr.synced_at < ?
                          THEN 1
                          ELSE 0
                        END), 0) AS reports_synced_in_range
     FROM ${DAMAGE_REPORTS_TABLE} dr`,
    [range.startDate, range.endExclusive, range.startDate, range.endExclusive],
  );

  const [qtyRows] = await pool.query(
    `SELECT COALESCE(SUM(dri.qty_damaged), 0) AS total_qty_damaged,
            COUNT(*) AS total_line_items
     FROM ${DAMAGE_REPORT_ITEMS_TABLE} dri
     INNER JOIN ${DAMAGE_REPORTS_TABLE} dr ON dr.id = dri.damage_report_id
     WHERE dr.status = 'synced'
       AND dr.synced_at >= ?
       AND dr.synced_at < ?`,
    [range.startDate, range.endExclusive],
  );

  const [syncRows] = await pool.query(
    `SELECT COUNT(*) AS sync_logs_total,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(dsl.status)) = 'success' THEN 1 ELSE 0 END), 0) AS sync_logs_success,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(dsl.status)) <> 'success' THEN 1 ELSE 0 END), 0) AS sync_logs_failed
     FROM ${DAMAGE_SYNC_LOGS_TABLE} dsl
     WHERE dsl.synced_at >= ?
       AND dsl.synced_at < ?`,
    [range.startDate, range.endExclusive],
  );

  return {
    draftReportsOpen: toNumber(reportRows[0]?.draft_reports_open),
    reportsCreatedInRange: toNumber(reportRows[0]?.reports_created_in_range),
    reportsSyncedInRange: toNumber(reportRows[0]?.reports_synced_in_range),
    totalQtyDamaged: toNumber(qtyRows[0]?.total_qty_damaged),
    totalLineItems: toNumber(qtyRows[0]?.total_line_items),
    syncLogsTotal: toNumber(syncRows[0]?.sync_logs_total),
    syncLogsSuccess: toNumber(syncRows[0]?.sync_logs_success),
    syncLogsFailed: toNumber(syncRows[0]?.sync_logs_failed),
  };
}

async function getDamageTopReasons(range, limit = 8) {
  const pool = getPool();
  await ensureDamageReportTables(pool);
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);

  const [rows] = await pool.query(
    `SELECT dri.damage_reason AS reason_label,
            COALESCE(SUM(dri.qty_damaged), 0) AS total_qty,
            COUNT(*) AS line_items
     FROM ${DAMAGE_REPORT_ITEMS_TABLE} dri
     INNER JOIN ${DAMAGE_REPORTS_TABLE} dr ON dr.id = dri.damage_report_id
     WHERE dr.status = 'synced'
       AND dr.synced_at >= ?
       AND dr.synced_at < ?
     GROUP BY dri.damage_reason
     ORDER BY total_qty DESC, line_items DESC
     LIMIT ?`,
    [range.startDate, range.endExclusive, safeLimit],
  );

  return rows.map((row) => ({
    reasonLabel: String(row.reason_label || 'Unknown'),
    totalQty: toNumber(row.total_qty),
    lineItems: toNumber(row.line_items),
  }));
}

async function getDamageTopProducts(range, limit = 10) {
  const pool = getPool();
  await ensureDamageReportTables(pool);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);

  const [rows] = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(dslit.product_name), ''), NULLIF(TRIM(dslit.product_barcode), ''), 'Unknown Product') AS product_name,
            COALESCE(SUM(dslit.qty_deducted), 0) AS qty_deducted,
            COALESCE(SUM(dslit.qty_requested), 0) AS qty_requested
     FROM ${DAMAGE_SYNC_LOG_ITEMS_TABLE} dslit
     INNER JOIN ${DAMAGE_SYNC_LOGS_TABLE} dsl ON dsl.id = dslit.sync_log_id
     WHERE dsl.synced_at >= ?
       AND dsl.synced_at < ?
     GROUP BY product_name
     ORDER BY qty_deducted DESC, qty_requested DESC
     LIMIT ?`,
    [range.startDate, range.endExclusive, safeLimit],
  );

  return rows.map((row) => ({
    productName: String(row.product_name),
    qtyDeducted: toNumber(row.qty_deducted),
    qtyRequested: toNumber(row.qty_requested),
  }));
}

async function getDamageSyncTrends(range, groupBy) {
  const pool = getPool();
  await ensureDamageReportTables(pool);
  const params = [range.startDate, range.endExclusive];

  let groupSelect = "DATE_FORMAT(dsl.synced_at, '%Y-%m-%d')";
  let groupOrder = 'DATE(dsl.synced_at)';

  if (groupBy === 'weekly') {
    groupSelect = "CONCAT(YEAR(dsl.synced_at), '-W', LPAD(WEEK(dsl.synced_at, 1), 2, '0'))";
    groupOrder = 'YEAR(dsl.synced_at), WEEK(dsl.synced_at, 1)';
  } else if (groupBy === 'monthly') {
    groupSelect = "DATE_FORMAT(dsl.synced_at, '%Y-%m')";
    groupOrder = "DATE_FORMAT(dsl.synced_at, '%Y-%m')";
  } else if (groupBy === 'yearly') {
    groupSelect = 'YEAR(dsl.synced_at)';
    groupOrder = 'YEAR(dsl.synced_at)';
  }

  const [rows] = await pool.query(
    `SELECT ${groupSelect} AS period_label,
            COUNT(*) AS sync_count,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(dsl.status)) = 'success' THEN 1 ELSE 0 END), 0) AS success_count,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(dsl.status)) <> 'success' THEN 1 ELSE 0 END), 0) AS failed_count
     FROM ${DAMAGE_SYNC_LOGS_TABLE} dsl
     WHERE dsl.synced_at >= ?
       AND dsl.synced_at < ?
     GROUP BY period_label
     ORDER BY ${groupOrder}`,
    params,
  );

  return rows.map((row) => ({
    period: String(row.period_label),
    syncCount: toNumber(row.sync_count),
    successCount: toNumber(row.success_count),
    failedCount: toNumber(row.failed_count),
  }));
}

async function getDashboardDamageReports({ startDate, endDate, groupBy }) {
  const normalizedGroupBy = normalizeGroupBy(groupBy);
  const range = getRangeBounds(startDate, endDate);

  const [summary, topReasons, topProducts, syncTrends] = await Promise.all([
    getDamageReportSummary(range),
    getDamageTopReasons(range, 10),
    getDamageTopProducts(range, 10),
    getDamageSyncTrends(range, normalizedGroupBy),
  ]);

  return {
    filters: {
      start_date: range.startDate,
      end_date: range.endDate,
      group_by: normalizedGroupBy,
    },
    summary,
    topReasons,
    topProducts,
    syncTrends,
    syncTrendSnapshot: sliceTrendPoints(syncTrends, 14),
    notes: [
      'Damaged quantities count items on reports synced within the selected date range.',
      'Top products use inventory sync log deductions for synced damage reports.',
    ],
  };
}

async function getDashboardOverview({ startDate, endDate, groupBy }) {
  const normalizedGroupBy = normalizeGroupBy(groupBy);
  const range = getRangeBounds(startDate, endDate);

  const [overview, alerts, dailySalesLastMonth, damageReports] = await Promise.all([
    getOverviewCards(),
    getInventoryAlertCounts(),
    getDailySalesLastMonth(),
    getDamageReportSummary(range).catch(() => ({
      draftReportsOpen: 0,
      reportsCreatedInRange: 0,
      reportsSyncedInRange: 0,
      totalQtyDamaged: 0,
      totalLineItems: 0,
      syncLogsTotal: 0,
      syncLogsSuccess: 0,
      syncLogsFailed: 0,
    })),
  ]);

  let topDamageReasons = [];

  try {
    topDamageReasons = await getDamageTopReasons(range, 5);
  } catch {
    topDamageReasons = [];
  }

  return {
    filters: {
      start_date: range.startDate,
      end_date: range.endDate,
      group_by: normalizedGroupBy,
    },
    overview,
    alerts,
    salesTrendSnapshot: dailySalesLastMonth.points,
    dailySalesLastMonth,
    damageReports,
    topDamageReasons,
  };
}

async function getDashboardSales({ startDate, endDate, groupBy }) {
  const normalizedGroupBy = normalizeGroupBy(groupBy);
  const range = getRangeBounds(startDate, endDate);

  const [dailySalesLastMonth, topProducts, salesByCategory, peakHours, discountsAndVoids] = await Promise.all([
    getDailySalesLastMonth(),
    getTopProducts(range, 100),
    getSalesByCategory(range),
    getPeakHours(range),
    getDiscountsAndVoids(range),
  ]);

  return {
    filters: {
      start_date: range.startDate,
      end_date: range.endDate,
      group_by: normalizedGroupBy,
    },
    trends: dailySalesLastMonth.points,
    dailySalesLastMonth,
    topProducts,
    salesByCategory,
    peakHours,
    discountsAndVoids,
  };
}

async function getDashboardInventory() {
  const inventory = await getInventorySummary();

  return { inventory };
}

async function getDashboardFinancial({ startDate, endDate }) {
  const range = getRangeBounds(startDate, endDate);

  const [paymentBreakdown, discountsAndVoids] = await Promise.all([
    getPaymentBreakdown(range),
    getDiscountsAndVoids(range),
  ]);

  const financial = await getFinancialSummary(range, paymentBreakdown, discountsAndVoids);

  return {
    filters: {
      start_date: range.startDate,
      end_date: range.endDate,
    },
    financial,
  };
}

async function getDashboardXData({ startDate, endDate, groupBy }) {
  const normalizedGroupBy = normalizeGroupBy(groupBy);
  const range = getRangeBounds(startDate, endDate);

  const [overviewPayload, salesPayload, inventoryPayload, financialPayload] = await Promise.all([
    getDashboardOverview({ startDate, endDate, groupBy: normalizedGroupBy }),
    getDashboardSales({ startDate, endDate, groupBy: normalizedGroupBy }),
    getDashboardInventory(),
    getDashboardFinancial({ startDate, endDate }),
  ]);

  return {
    filters: {
      start_date: range.startDate,
      end_date: range.endDate,
      group_by: normalizedGroupBy,
    },
    overview: overviewPayload.overview,
    salesRevenue: {
      trends: salesPayload.trends,
      topProducts: salesPayload.topProducts,
      salesByCategory: salesPayload.salesByCategory,
      peakHours: salesPayload.peakHours,
      discountsAndVoids: salesPayload.discountsAndVoids,
    },
    inventory: inventoryPayload.inventory,
    financial: financialPayload.financial,
  };
}

module.exports = {
  getDashboardXData,
  getDashboardOverview,
  getDashboardSales,
  getDashboardInventory,
  getDashboardFinancial,
  getDashboardDamageReports,
};
