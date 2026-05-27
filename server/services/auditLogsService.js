const { getPool } = require('../db');

function toDateString(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeUsername(value) {
  const text = toDateString(value);
  if (!text || text.toLowerCase() === 'all') {
    return null;
  }

  return text;
}

function ensureValidDate(value, fieldName) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error(`${fieldName} must be in YYYY-MM-DD format.`);
    error.statusCode = 400;
    throw error;
  }
}

function resolveDateRange(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  const resolvedStart = toDateString(startDate) || today;
  const resolvedEnd = toDateString(endDate) || today;

  ensureValidDate(resolvedStart, 'start_date');
  ensureValidDate(resolvedEnd, 'end_date');

  if (resolvedStart > resolvedEnd) {
    const error = new Error('start_date cannot be later than end_date.');
    error.statusCode = 400;
    throw error;
  }

  return {
    startDate: resolvedStart,
    endDate: resolvedEnd,
  };
}

async function listAuditLogs({ startDate, endDate, username }) {
  const range = resolveDateRange(startDate, endDate);
  const normalizedUsername = normalizeUsername(username);

  const whereClauses = ['DATE(created_at) BETWEEN ? AND ?'];
  const params = [range.startDate, range.endDate];

  if (normalizedUsername) {
    whereClauses.push('username = ?');
    params.push(normalizedUsername);
  }

  const [rows] = await getPool().query(
    `SELECT id, user_id, username, action_type, table_name, product_barcode,
            description, machineid, ptunumber, ip_address, device_info, created_at
     FROM audit_logs
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY created_at DESC, id DESC`,
    params,
  );

  return {
    range,
    username: normalizedUsername,
    rows,
  };
}

async function listAuditLogUsers() {
  const [rows] = await getPool().query(
    `SELECT user_id, username
     FROM audit_logs
     WHERE username IS NOT NULL AND TRIM(username) <> ''
     GROUP BY user_id, username
     ORDER BY username ASC`,
  );

  return rows;
}

module.exports = {
  listAuditLogs,
  listAuditLogUsers,
};
