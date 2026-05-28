#!/usr/bin/env node
/** Prints suggested CHECKOUT_E2E_* values from the database (no secrets). */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { getPool } = require('../db');

async function main() {
  const pool = getPool();

  const [terminals] = await pool.query(
    `SELECT machine_name, current_or, min_number
     FROM terminals_a
     ORDER BY ID ASC
     LIMIT 5`,
  );

  const [series] = await pool.query(
    `SELECT full_series_no, machine_id, lockbatch
     FROM sales_series
     WHERE COALESCE(lockbatch, 'N') != 'Y'
     ORDER BY ID DESC
     LIMIT 5`,
  );

  const [products] = await pool.query(
    `SELECT pb.product_barcode AS barcode, pb.batch_id, COALESCE(pb.Qty, 0) AS qty
     FROM product_batches pb
     WHERE COALESCE(pb.Block, 0) = 0 AND COALESCE(pb.Qty, 0) > 0
     ORDER BY pb.id ASC
     LIMIT 5`,
  );

  const [users] = await pool.query(
    `SELECT user_id, username FROM users WHERE COALESCE(ACTIVE, 'Y') = 'Y' ORDER BY user_id ASC LIMIT 5`,
  );

  console.log(JSON.stringify({ terminals, series, products, users }, null, 2));
  await pool.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
