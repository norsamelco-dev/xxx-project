#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { ensureReceiptHeadingPrintLogoColumns } = require('../db/ensureReceiptHeadingPrintLogo');
const { getReceiptHeading } = require('../services/receiptHeadingService');
const { buildLogoEscPosBuffer } = require('../utils/escPosLogo');

async function main() {
  await ensureReceiptHeadingPrintLogoColumns();
  const heading = await getReceiptHeading();

  if (!heading) {
    throw new Error('No receipt_heading row found.');
  }

  const buffer = await buildLogoEscPosBuffer(heading);
  if (!buffer) {
    throw new Error('Logo buffer was not generated. Check business_logo_path and print_logo_enabled.');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        business_logo_path: heading.business_logo_path,
        print_logo_width: heading.print_logo_width,
        print_logo_align: heading.print_logo_align,
        print_logo_enabled: heading.print_logo_enabled,
        escpos_bytes: buffer.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('Print logo test failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    const { getPool } = require('../db');
    const pool = getPool();
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });
