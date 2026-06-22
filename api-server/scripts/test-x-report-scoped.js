#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { getPool } = require('../db');
const { getXReport } = require('../services/posService');
const { findUserByUsername, toSessionUser } = require('../services/userService');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const machineName = process.env.CHECKOUT_E2E_MACHINE || 'POS-0001';
  const username = process.env.CHECKOUT_E2E_USER || 'cashier1';
  const pool = getPool();
  const dbUser = await findUserByUsername(username);
  assert(dbUser, `User not found: ${username}`);
  const posUser = toSessionUser(dbUser);

  const [seriesRows] = await pool.query(
    `SELECT full_series_no
     FROM sales_series
     WHERE machine_id = ?
       AND userid = ?
       AND COALESCE(lockbatch, 'N') != 'Y'
     ORDER BY ID DESC
     LIMIT 1`,
    [machineName, posUser.userId],
  );
  assert(seriesRows.length, 'No open series for user');
  const seriesNo = seriesRows[0].full_series_no;

  const report = await getXReport(machineName, seriesNo, posUser);
  assert(report.sales_series_no === seriesNo, 'Report should include sales_series_no');

  const [seriesScoped] = await pool.query(
    `SELECT COALESCE(SUM(sales_grandtotal), 0) AS total
     FROM sales_a
     WHERE sales_series_no = ?
       AND userid = ?
       AND MachineName = ?
       AND COALESCE(VOIDED, 'N') = 'N'`,
    [seriesNo, posUser.userId, machineName],
  );

  const expected = Number(seriesScoped[0].total) || 0;
  assert(Math.abs(report.total_sales - expected) < 0.01, 'Report total must match series-scoped sales');

  console.log(`X report scoped OK — series ${seriesNo}, total_sales ${report.total_sales}`);
}

main().catch((error) => {
  console.error('X report scoped test FAILED:', error.message);
  process.exit(1);
});
