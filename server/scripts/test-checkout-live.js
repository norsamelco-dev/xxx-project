#!/usr/bin/env node
/**
 * Live checkout test (service-level, no HTTP password required).
 * Uses cashier1 from DB, POS-0001, first in-stock barcode.
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { getPool } = require('../db');
const { ensureCheckoutSchema } = require('../db/ensureCartSchema');
const {
  addToCartFifo,
  clearCart,
  checkout,
  listCartLines,
} = require('../services/posService');
const { findUserByUsername, toSessionUser } = require('../services/userService');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const pool = getPool();
  await ensureCheckoutSchema();

  const username = process.env.CHECKOUT_E2E_USER || 'cashier1';
  const machineName = process.env.CHECKOUT_E2E_MACHINE || 'POS-0001';
  const barcode = process.env.CHECKOUT_E2E_BARCODE || '4801981118502';

  const dbUser = await findUserByUsername(username);
  assert(dbUser, `User not found: ${username}`);
  const posUser = toSessionUser(dbUser);

  const [seriesRows] = await pool.query(
    `SELECT full_series_no FROM sales_series
     WHERE machine_id = ? AND COALESCE(lockbatch, 'N') != 'Y'
     ORDER BY ID DESC LIMIT 1`,
    [machineName],
  );
  assert(seriesRows.length, `No open sales series for ${machineName}`);
  const seriesNo = seriesRows[0].full_series_no;

  const [terminalBefore] = await pool.query(
    'SELECT current_or FROM terminals_a WHERE machine_name = ? LIMIT 1',
    [machineName],
  );
  assert(terminalBefore.length, 'Terminal not found');
  const orBefore = Number(terminalBefore[0].current_or);

  console.log(`\n=== Checkout live test ===`);
  console.log(`User: ${username} (${posUser.userId})`);
  console.log(`Terminal: ${machineName}, series: ${seriesNo}`);
  console.log(`Barcode: ${barcode}, OR before: ${orBefore}\n`);

  await clearCart(posUser);
  await addToCartFifo({ barcode, qty: 1 }, posUser);

  const cartLines = await listCartLines(posUser);
  assert(cartLines.length > 0, 'Cart should have lines after add');
  console.log(`Cart lines: ${cartLines.length} (qty ${cartLines[0].qty}, total ${cartLines[0].total})`);

  const cartTotal = cartLines.reduce((sum, line) => sum + Number(line.total || 0), 0);

  const cashResult = await checkout(
    {
      machine_name: machineName,
      sales_series_no: seriesNo,
      payment_method: 'CASH PAYMENT',
      payment_ref_no: 'N/A',
      amt_tendered: Math.max(cartTotal, 1),
      discount_rate: 0,
    },
    posUser,
  );

  console.log(`\nCash checkout OK`);
  console.log(`  ORSI: ${cashResult.orsi_display} (next ${cashResult.next_orsi_display})`);
  console.log(`  Grand total: ${cashResult.totals.grandTotal}`);
  console.log(`  Change: ${cashResult.amt_change}`);

  assert(cashResult.orsi === orBefore, 'ORSI should match terminal current_or before sale');

  const [salesA] = await pool.query(
    'SELECT ORSI, payment_method, VOIDED FROM sales_a WHERE ORSI = ? AND MachineName = ? LIMIT 1',
    [cashResult.orsi, machineName],
  );
  assert(salesA.length === 1, 'sales_a row missing');
  assert(String(salesA[0].VOIDED).toUpperCase() === 'N');

  const [salesB] = await pool.query('SELECT COUNT(*) AS cnt FROM sales_b WHERE ORSI = ?', [cashResult.orsi]);
  assert(Number(salesB[0].cnt) > 0, 'sales_b lines missing');

  const [terminalAfterCash] = await pool.query(
    'SELECT current_or FROM terminals_a WHERE machine_name = ? LIMIT 1',
    [machineName],
  );
  assert(Number(terminalAfterCash[0].current_or) === orBefore + 1, 'current_or should increment');

  const [cartAfterCash] = await pool.query('SELECT COUNT(*) AS cnt FROM cart WHERE USERID = ?', [posUser.userId]);
  assert(Number(cartAfterCash[0].cnt) === 0, 'cart should be empty after checkout');

  await addToCartFifo({ barcode, qty: 1 }, posUser);
  const cardCart = await listCartLines(posUser);
  const cardTotal = cardCart.reduce((sum, line) => sum + Number(line.total || 0), 0);

  const cardResult = await checkout(
    {
      machine_name: machineName,
      sales_series_no: seriesNo,
      payment_method: 'CARD PAYMENT',
      payment_ref_no: 'LIVE-TEST-REF',
      amt_tendered: Math.max(cardTotal, 1),
      discount_rate: 0,
    },
    posUser,
  );

  console.log(`\nCard checkout OK`);
  console.log(`  ORSI: ${cardResult.orsi_display}`);
  console.log(`  Change: ${cardResult.amt_change} (expected 0)`);
  console.log(`  Ref: ${cardResult.payment_ref_no}`);

  assert(cardResult.amt_change === 0, 'Card change must be 0');
  assert(cardResult.payment_ref_no === 'LIVE-TEST-REF');

  const [cartAfterCard] = await pool.query('SELECT COUNT(*) AS cnt FROM cart WHERE USERID = ?', [posUser.userId]);
  assert(Number(cartAfterCard[0].cnt) === 0, 'cart should be empty after card checkout');

  console.log('\n=== All checkout checks passed ===\n');
}

main()
  .catch((error) => {
    console.error('\nCheckout test FAILED:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    const pool = getPool();
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });
