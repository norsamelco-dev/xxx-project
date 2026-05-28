#!/usr/bin/env node
/**
 * Verifies checkout-related MySQL schema (cart table, unique index, sales_series.starting_balance).
 * Applies missing schema via ensureCheckoutSchema when CHECKOUT_SCHEMA_APPLY=1 (default).
 *
 * Usage:
 *   node scripts/verify-checkout-schema.js
 *   CHECKOUT_SCHEMA_APPLY=0 node scripts/verify-checkout-schema.js   # verify only
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { getPool } = require('../db');
const { ensureCheckoutSchema, verifyCheckoutSchema } = require('../db/ensureCartSchema');

async function main() {
  const apply = process.env.CHECKOUT_SCHEMA_APPLY !== '0';

  try {
    getPool();
    await getPool().query('SELECT 1');

    if (apply) {
      await ensureCheckoutSchema();
    }

    const result = await verifyCheckoutSchema();

    console.log(JSON.stringify(result, null, 2));

    if (!result.ok) {
      if (!apply) {
        console.error('\nSchema incomplete. Run with CHECKOUT_SCHEMA_APPLY=1 or start the API server.');
      }
      process.exit(1);
    }

    console.log('\nCheckout schema OK.');
    process.exit(0);
  } catch (error) {
    console.error('Schema verification failed:', error.message);
    process.exit(1);
  } finally {
    const pool = getPool();
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  }
}

main();
