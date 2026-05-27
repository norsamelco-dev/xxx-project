/**
 * Checkout schema + optional HTTP E2E tests.
 *
 * Always runs schema verification (requires DB in server/.env).
 * Full sale E2E runs when CHECKOUT_E2E=1 and credentials are set:
 *   CHECKOUT_E2E_USER, CHECKOUT_E2E_PASS, CHECKOUT_E2E_MACHINE, CHECKOUT_E2E_BARCODE
 *   CHECKOUT_E2E_API_URL (default http://127.0.0.1:5000)
 */
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { getPool } = require('../db');
const { ensureCheckoutSchema, verifyCheckoutSchema } = require('../db/ensureCartSchema');

const apiBase = process.env.CHECKOUT_E2E_API_URL || 'http://127.0.0.1:5000';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

test('checkout schema: cart table and unique index', async () => {
  getPool();
  await ensureCheckoutSchema();
  const result = await verifyCheckoutSchema();

  assert.equal(result.checks.cart_table, true, 'cart table must exist');
  assert.equal(result.checks.cart_unique_index, true, 'cart_user_line unique index must exist');
  assert.equal(result.checks.sales_series_starting_balance, true, 'sales_series.starting_balance must exist');
  assert.equal(result.ok, true);
});

test('checkout E2E: cash sale persists sales and clears cart', { skip: process.env.CHECKOUT_E2E !== '1' && 'Set CHECKOUT_E2E=1' }, async () => {
  const username = process.env.CHECKOUT_E2E_USER;
  const password = process.env.CHECKOUT_E2E_PASS;
  const machineName = process.env.CHECKOUT_E2E_MACHINE;
  const barcode = process.env.CHECKOUT_E2E_BARCODE;

  assert.ok(username, 'CHECKOUT_E2E_USER required');
  assert.ok(password, 'CHECKOUT_E2E_PASS required');
  assert.ok(machineName, 'CHECKOUT_E2E_MACHINE required');
  assert.ok(barcode, 'CHECKOUT_E2E_BARCODE required');

  const pool = getPool();

  const login = await fetchJson(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-pos-client': '1' },
    body: JSON.stringify({ username, password, mobile: true }),
  });

  assert.equal(login.response.status, 200, login.body.error || 'login failed');
  const token = login.body.token;
  assert.ok(token, 'Bearer token required');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  await fetchJson(`${apiBase}/api/pos/cart/clear`, { method: 'POST', headers: authHeaders, body: '{}' });

  const [terminalRows] = await pool.query(
    'SELECT current_or, min_number FROM terminals_a WHERE machine_name = ? LIMIT 1',
    [machineName],
  );
  assert.ok(terminalRows.length, 'terminal must exist');
  const orBefore = Number(terminalRows[0].current_or);

  const [seriesRows] = await pool.query(
    `SELECT full_series_no FROM sales_series
     WHERE machine_id = ? AND lockbatch != 'Y'
     ORDER BY ID DESC LIMIT 1`,
    [machineName],
  );
  assert.ok(seriesRows.length, 'open sales series required');
  const seriesNo = seriesRows[0].full_series_no;

  const add = await fetchJson(`${apiBase}/api/pos/cart/add`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode, qty: 1 }),
  });
  assert.equal(add.response.status, 200, add.body.error || 'cart add failed');

  const cartBefore = await fetchJson(`${apiBase}/api/pos/cart`, { headers: authHeaders });
  assert.ok(Array.isArray(cartBefore.body.data) && cartBefore.body.data.length > 0, 'cart must have lines');

  const cartTotal = cartBefore.body.data.reduce((sum, line) => sum + Number(line.total || 0), 0);
  const amtTendered = Math.max(cartTotal, 1);

  const checkoutRes = await fetchJson(`${apiBase}/api/pos/checkout`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      machine_name: machineName,
      sales_series_no: seriesNo,
      payment_method: 'CASH PAYMENT',
      payment_ref_no: 'N/A',
      amt_tendered: amtTendered,
      discount_rate: 0,
    }),
  });

  assert.equal(checkoutRes.response.status, 201, checkoutRes.body.error || 'checkout failed');
  const orsi = checkoutRes.body.data.orsi;
  assert.equal(orsi, orBefore, 'ORSI should match terminal current_or before increment');

  const [salesARows] = await pool.query('SELECT ORSI, VOIDED FROM sales_a WHERE ORSI = ? AND MachineName = ? LIMIT 1', [
    orsi,
    machineName,
  ]);
  assert.equal(salesARows.length, 1, 'sales_a header must exist');
  assert.equal(String(salesARows[0].VOIDED).toUpperCase(), 'N');

  const [salesBRows] = await pool.query('SELECT COUNT(*) AS cnt FROM sales_b WHERE ORSI = ?', [orsi]);
  assert.ok(Number(salesBRows[0].cnt) > 0, 'sales_b lines must exist');

  const [terminalAfter] = await pool.query('SELECT current_or FROM terminals_a WHERE machine_name = ? LIMIT 1', [
    machineName,
  ]);
  assert.equal(Number(terminalAfter[0].current_or), orBefore + 1, 'current_or must increment');

  const userId = login.body.user.userId;
  const [cartRows] = await pool.query('SELECT COUNT(*) AS cnt FROM cart WHERE USERID = ?', [userId]);
  assert.equal(Number(cartRows[0].cnt), 0, 'cart must be cleared after checkout');

  const cardAdd = await fetchJson(`${apiBase}/api/pos/cart/add`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode, qty: 1 }),
  });
  assert.equal(cardAdd.response.status, 200);

  const cardCart = await fetchJson(`${apiBase}/api/pos/cart`, { headers: authHeaders });
  const cardCartTotal = cardCart.body.data.reduce((sum, line) => sum + Number(line.total || 0), 0);

  const cardSale = await fetchJson(`${apiBase}/api/pos/checkout`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      machine_name: machineName,
      sales_series_no: seriesNo,
      payment_method: 'CARD PAYMENT',
      payment_ref_no: 'E2E-TEST-REF',
      amt_tendered: Math.max(cardCartTotal, 1),
      discount_rate: 0,
    }),
  });
  assert.equal(cardSale.response.status, 201, cardSale.body.error || 'card checkout failed');
  assert.equal(cardSale.body.data.amt_change, 0, 'card sales must have zero change');
  assert.equal(cardSale.body.data.payment_ref_no, 'E2E-TEST-REF');
});

test.after(async () => {
  const pool = getPool();
  if (pool && typeof pool.end === 'function') {
    await pool.end();
  }
});
