const { getPool } = require('../db');

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

function ensureValidOrsi(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error('A valid ORSI is required.');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function buildSeriesAggregateJoins() {
  return `
     LEFT JOIN (
       SELECT sa.sales_series_no,
              COUNT(*) AS transaction_count,
              MIN(sa.ORSI) AS first_orsi,
              MAX(sa.ORSI) AS last_orsi
       FROM sales_a sa
       WHERE sa.branch_id = ?
       GROUP BY sa.sales_series_no
     ) sa_agg ON sa_agg.sales_series_no = ss.full_series_no
     LEFT JOIN (
       SELECT sa.sales_series_no,
              COALESCE(
                SUM(
                  CASE
                    WHEN COALESCE(sa.sales_vat_rate, 0) > 0
                      THEN COALESCE(sb.TOTAL, 0) / (1 + COALESCE(sa.sales_vat_rate, 0))
                    ELSE COALESCE(sb.TOTAL, 0)
                  END
                ),
                0
              ) AS totalsales,
              COALESCE(
                SUM(
                  CASE
                    WHEN COALESCE(sa.sales_vat_rate, 0) > 0
                      THEN COALESCE(sb.TOTAL, 0) - (COALESCE(sb.TOTAL, 0) / (1 + COALESCE(sa.sales_vat_rate, 0)))
                    ELSE 0
                  END
                ),
                0
              ) AS vat_amount,
              COALESCE(SUM(COALESCE(sb.TOTAL, 0)), 0) AS grand_total
       FROM sales_a sa
       INNER JOIN sales_b sb ON sb.ORSI = sa.ORSI AND sb.branch_id = sa.branch_id
       WHERE UPPER(TRIM(COALESCE(sa.VOIDED, 'N'))) <> 'Y'
         AND UPPER(TRIM(COALESCE(sb.VOIDED, 'N'))) <> 'Y'
         AND sa.branch_id = ?
       GROUP BY sa.sales_series_no
     ) sb_agg ON sb_agg.sales_series_no = ss.full_series_no`;
}

async function listSalesSeries({ branchId, startDate, endDate, search }) {
  const normalizedStartDate = ensureValidDate(startDate, 'start_date');
  const normalizedEndDate = ensureValidDate(endDate, 'end_date');

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    const error = new Error('start_date cannot be later than end_date.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedSearch = normalizeText(search);
  const whereClauses = ['ss.branch_id = ?'];
  const params = [branchId];

  if (normalizedStartDate) {
    whereClauses.push('ss.created_at >= ?');
    params.push(normalizedStartDate);
  }

  if (normalizedEndDate) {
    whereClauses.push('ss.created_at <= ?');
    params.push(normalizedEndDate);
  }

  if (normalizedSearch) {
    const likeValue = `%${normalizedSearch.toLowerCase()}%`;
    whereClauses.push('(LOWER(ss.full_series_no) LIKE ? OR LOWER(ss.machine_id) LIKE ? OR LOWER(ss.username) LIKE ?)');
    params.push(likeValue, likeValue, likeValue);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await getPool().query(
    `SELECT ss.ID,
            ss.created_at,
            ss.full_series_no,
            ss.machine_id,
            ss.min_number,
            ss.ptu,
            ss.seriesno,
            ss.starting_balance,
            COALESCE(sb_agg.totalsales, 0) AS totalsales,
            COALESCE(sb_agg.vat_amount, 0) AS vat_amount,
            COALESCE(sb_agg.grand_total, 0) AS grand_total,
            ss.userid,
            ss.username,
            ss.lockbatch,
            COALESCE(sa_agg.transaction_count, 0) AS transaction_count,
            sa_agg.first_orsi,
            sa_agg.last_orsi
     FROM sales_series ss
     ${buildSeriesAggregateJoins()}
     ${whereSql}
     GROUP BY ss.ID,
              ss.created_at,
              ss.full_series_no,
              ss.machine_id,
              ss.min_number,
              ss.ptu,
              ss.seriesno,
              ss.starting_balance,
              sb_agg.totalsales,
              sb_agg.vat_amount,
              sb_agg.grand_total,
              ss.userid,
              ss.username,
              ss.lockbatch,
              sa_agg.transaction_count,
              sa_agg.first_orsi,
              sa_agg.last_orsi
     ORDER BY ss.created_at DESC, ss.ID DESC`,
    [branchId, branchId, ...params],
  );

  return {
    filters: {
      start_date: normalizedStartDate,
      end_date: normalizedEndDate,
      search: normalizedSearch,
    },
    rows,
  };
}

async function listSalesTransactionsBySeries(seriesNo, branchId) {
  const normalizedSeriesNo = normalizeText(seriesNo);

  if (!normalizedSeriesNo) {
    const error = new Error('A valid sales series number is required.');
    error.statusCode = 400;
    throw error;
  }

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
            COUNT(sb.ID) AS line_item_count
     FROM sales_a sa
     LEFT JOIN sales_b sb ON sb.ORSI = sa.ORSI AND sb.branch_id = sa.branch_id
     WHERE sa.sales_series_no = ?
       AND sa.branch_id = ?
     GROUP BY sa.ID,
              sa.Created_at,
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
              sa.VOID_REASON
     ORDER BY sa.Created_at DESC, sa.ID DESC`,
    [normalizedSeriesNo, branchId],
  );

  return rows;
}

function ensurePosAccessContext({ machineName, userId, minNumber }) {
  const normalizedMachine = normalizeText(machineName);
  const normalizedMin = normalizeText(minNumber);
  const parsedUserId = Number(userId);

  if (!normalizedMachine) {
    const error = new Error('machine_name is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedMin) {
    const error = new Error('Terminal MIN number is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    const error = new Error('A valid cashier is required.');
    error.statusCode = 400;
    throw error;
  }

  return {
    machineName: normalizedMachine,
    userId: parsedUserId,
    minNumber: normalizedMin,
  };
}

async function listSalesSeriesForPos({ branchId, machineName, userId, minNumber, limit = 50 }) {
  const access = ensurePosAccessContext({ machineName, userId, minNumber });
  const rowLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const [rows] = await getPool().query(
    `SELECT ss.ID,
            ss.created_at,
            ss.full_series_no,
            ss.machine_id,
            ss.min_number,
            ss.ptu,
            ss.seriesno,
            ss.starting_balance,
            COALESCE(sb_agg.totalsales, 0) AS totalsales,
            COALESCE(sb_agg.vat_amount, 0) AS vat_amount,
            COALESCE(sb_agg.grand_total, 0) AS grand_total,
            ss.userid,
            ss.username,
            ss.lockbatch,
            COALESCE(sa_agg.transaction_count, 0) AS transaction_count,
            sa_agg.first_orsi,
            sa_agg.last_orsi
     FROM sales_series ss
     ${buildSeriesAggregateJoins()}
     WHERE ss.branch_id = ?
       AND ss.machine_id = ?
       AND ss.min_number = ?
       AND ss.userid = ?
     GROUP BY ss.ID,
              ss.created_at,
              ss.full_series_no,
              ss.machine_id,
              ss.min_number,
              ss.ptu,
              ss.seriesno,
              ss.starting_balance,
              sb_agg.totalsales,
              sb_agg.vat_amount,
              sb_agg.grand_total,
              ss.userid,
              ss.username,
              ss.lockbatch,
              sa_agg.transaction_count,
              sa_agg.first_orsi,
              sa_agg.last_orsi
     ORDER BY ss.created_at DESC, ss.ID DESC
     LIMIT ?`,
    [branchId, branchId, branchId, access.machineName, access.minNumber, access.userId, rowLimit],
  );

  return rows;
}

async function assertSalesSeriesAccess(seriesNo, { branchId, machineName, userId, minNumber }) {
  const normalizedSeriesNo = normalizeText(seriesNo);
  const access = ensurePosAccessContext({ machineName, userId, minNumber });

  if (!normalizedSeriesNo) {
    const error = new Error('A valid sales series number is required.');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await getPool().query(
    `SELECT ss.full_series_no
     FROM sales_series ss
     WHERE ss.full_series_no = ?
       AND ss.branch_id = ?
       AND ss.machine_id = ?
       AND ss.min_number = ?
       AND ss.userid = ?
     LIMIT 1`,
    [normalizedSeriesNo, branchId, access.machineName, access.minNumber, access.userId],
  );

  if (!rows.length) {
    const error = new Error('Sales series not found for this terminal and cashier.');
    error.statusCode = 404;
    throw error;
  }

  return normalizedSeriesNo;
}

async function assertTransactionAccess(orsi, { branchId, machineName, userId, minNumber }) {
  const normalizedOrsi = ensureValidOrsi(orsi);
  const access = ensurePosAccessContext({ machineName, userId, minNumber });

  const [rows] = await getPool().query(
    `SELECT sa.ORSI
     FROM sales_a sa
     INNER JOIN sales_series ss ON ss.full_series_no = sa.sales_series_no AND ss.branch_id = sa.branch_id
     WHERE sa.ORSI = ?
       AND sa.branch_id = ?
       AND ss.machine_id = ?
       AND ss.min_number = ?
       AND ss.userid = ?
     LIMIT 1`,
    [normalizedOrsi, branchId, access.machineName, access.minNumber, access.userId],
  );

  if (!rows.length) {
    const error = new Error('Sales transaction not found for this terminal and cashier.');
    error.statusCode = 404;
    throw error;
  }

  return normalizedOrsi;
}

async function listPosSalesTransactionsBySeries(seriesNo, accessContext) {
  const normalizedSeriesNo = await assertSalesSeriesAccess(seriesNo, accessContext);
  return listSalesTransactionsBySeries(normalizedSeriesNo, accessContext.branchId);
}

async function listPosSalesItemsByTransaction(orsi, accessContext) {
  const normalizedOrsi = await assertTransactionAccess(orsi, accessContext);
  return listSalesItemsByTransaction(normalizedOrsi, accessContext.branchId);
}

async function listSalesItemsByTransaction(orsi, branchId) {
  const normalizedOrsi = ensureValidOrsi(orsi);

  const [rows] = await getPool().query(
    `SELECT sb.ID,
            sb.DATECREATED AS created_at,
            sb.sales_series_no,
            sb.ORSI,
            sb.CATEGORY,
            sb.BATCHID,
            sb.BARCODE,
            sb.DESCRIPTION,
            sb.BRAND,
            sb.UNIT,
            sb.QTY,
            sb.PRICE,
            sb.TOTAL,
            sb.VOIDED
     FROM sales_b sb
     WHERE sb.ORSI = ?
       AND sb.branch_id = ?
     ORDER BY sb.ID ASC`,
    [normalizedOrsi, branchId],
  );

  return rows;
}

module.exports = {
  listSalesSeries,
  listSalesSeriesForPos,
  listSalesTransactionsBySeries,
  listPosSalesTransactionsBySeries,
  listSalesItemsByTransaction,
  listPosSalesItemsByTransaction,
  assertSalesSeriesAccess,
  assertTransactionAccess,
};
