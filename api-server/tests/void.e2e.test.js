/**
 * Void / cancel E2E (requires CHECKOUT_E2E=1 and same env vars as checkout.e2e.test.js).
 */
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { getPool } = require('../db');

const apiBase = process.env.CHECKOUT_E2E_API_URL || 'http://127.0.0.1:5000';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login() {
  const username = process.env.CHECKOUT_E2E_USER;
  const password = process.env.CHECKOUT_E2E_PASS;

  const login = await fetchJson(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-pos-client': '1' },
    body: JSON.stringify({ username, password, mobile: true }),
  });

  assert.equal(login.response.status, 200, login.body.error || 'login failed');

  return {
    authHeaders: {
      Authorization: `Bearer ${login.body.token}`,
      'Content-Type': 'application/json',
    },
    pool: getPool(),
  };
}

async function checkoutSale(authHeaders, machineName, seriesNo, barcode, qty = 1) {
  await fetchJson(`${apiBase}/api/pos/cart/clear`, { method: 'POST', headers: authHeaders, body: '{}' });

  const add = await fetchJson(`${apiBase}/api/pos/cart/add`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode, qty }),
  });
  assert.equal(add.response.status, 200, add.body.error || 'cart add failed');

  const cartRes = await fetchJson(`${apiBase}/api/pos/cart`, { headers: authHeaders });
  const cartTotal = cartRes.body.data.reduce((sum, line) => sum + Number(line.total || 0), 0);

  const checkoutRes = await fetchJson(`${apiBase}/api/pos/checkout`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      machine_name: machineName,
      sales_series_no: seriesNo,
      payment_method: 'CASH PAYMENT',
      payment_ref_no: 'N/A',
      amt_tendered: Math.max(cartTotal, 1),
      discount_rate: 0,
    }),
  });

  assert.equal(checkoutRes.response.status, 201, checkoutRes.body.error || 'checkout failed');
  return checkoutRes.body.data.orsi;
}

test('void E2E: cancel ORSI, receipt, closed-series guard', { skip: process.env.CHECKOUT_E2E !== '1' && 'Set CHECKOUT_E2E=1' }, async () => {
  const machineName = process.env.CHECKOUT_E2E_MACHINE;
  const barcode = process.env.CHECKOUT_E2E_BARCODE;

  assert.ok(machineName, 'CHECKOUT_E2E_MACHINE required');
  assert.ok(barcode, 'CHECKOUT_E2E_BARCODE required');

  const { authHeaders, pool } = await login();

  const [seriesRows] = await pool.query(
    `SELECT full_series_no FROM sales_series
     WHERE machine_id = ? AND lockbatch != 'Y'
     ORDER BY ID DESC LIMIT 1`,
    [machineName],
  );
  assert.ok(seriesRows.length, 'open sales series required');
  const seriesNo = seriesRows[0].full_series_no;

  const [batchBefore] = await pool.query(
    `SELECT COALESCE(quantity_remaining, Qty, 0) AS qty
     FROM product_batches
     WHERE product_barcode = ?
     ORDER BY ID DESC LIMIT 1`,
    [barcode],
  );
  const stockBefore = Number(batchBefore[0]?.qty || 0);

  const orsi = await checkoutSale(authHeaders, machineName, seriesNo, barcode, 1);

  const receiptRes = await fetchJson(
    `${apiBase}/api/pos/sales/transactions/${orsi}/receipt?machine_name=${encodeURIComponent(machineName)}`,
    { headers: authHeaders },
  );
  assert.equal(receiptRes.response.status, 200);
  assert.ok(receiptRes.body.data.checkout?.lines?.length >= 1);

  const voidTxn = await fetchJson(`${apiBase}/api/pos/sales/transactions/${orsi}/void`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ machine_name: machineName, void_reason: 'E2E cancel ORSI test' }),
  });
  assert.equal(voidTxn.response.status, 200, voidTxn.body.error || 'void transaction failed');
  assert.equal(String(voidTxn.body.data.transaction.VOIDED).toUpperCase(), 'Y');

  const [batchAfterVoid] = await pool.query(
    `SELECT COALESCE(quantity_remaining, Qty, 0) AS qty
     FROM product_batches
     WHERE product_barcode = ?
     ORDER BY ID DESC LIMIT 1`,
    [barcode],
  );
  assert.ok(Number(batchAfterVoid[0]?.qty || 0) >= stockBefore, 'stock should be restored after cancel');

  const voidAgain = await fetchJson(`${apiBase}/api/pos/sales/transactions/${orsi}/void`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ machine_name: machineName, void_reason: 'duplicate void' }),
  });
  assert.equal(voidAgain.response.status, 409);

  const orsi2 = await checkoutSale(authHeaders, machineName, seriesNo, barcode, 1);

  await pool.query(`UPDATE sales_series SET lockbatch = 'Y' WHERE full_series_no = ?`, [seriesNo]);

  const voidClosed = await fetchJson(`${apiBase}/api/pos/sales/transactions/${orsi2}/void`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ machine_name: machineName, void_reason: 'should fail closed series' }),
  });
  assert.equal(voidClosed.response.status, 409);

  await pool.query(`UPDATE sales_series SET lockbatch = 'N' WHERE full_series_no = ?`, [seriesNo]);
});
