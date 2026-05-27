const mysql = require('mysql2/promise');

let pool;

function getDatabaseConfig() {
  const requiredKeys = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingKeys = requiredKeys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing database environment values: ${missingKeys.join(', ')}`);
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDatabaseConfig());
  }

  return pool;
}

async function listTables() {
  const database = process.env.DB_NAME;
  const [rows] = await getPool().query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME`,
    [database],
  );

  return rows.map((row) => row.TABLE_NAME);
}

async function ensureKnownTable(tableName) {
  const tables = await listTables();

  if (!tables.includes(tableName)) {
    const error = new Error(`Unknown table: ${tableName}`);
    error.statusCode = 404;
    throw error;
  }

  return tables;
}

module.exports = {
  getPool,
  listTables,
  ensureKnownTable,
};