require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { getPool } = require('../db');

async function main() {
  const pool = getPool();
  const [indexes] = await pool.query(`SHOW INDEX FROM cart WHERE Key_name = 'cart_user_line'`);
  console.log('cart_user_line index:', indexes.length > 0 ? 'YES' : 'NO');

  const [rows] = await pool.query(
    `SELECT ID, BATCHID, BARCODE, QTY, USERID FROM cart WHERE BARCODE = ? ORDER BY ID`,
    ['4801981118502'],
  );
  console.log('cart rows for barcode:', rows);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
