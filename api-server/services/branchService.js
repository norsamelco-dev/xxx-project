const { getPool } = require('../db');

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeBranchCode(value) {
  const code = normalizeText(value);
  if (!code) {
    const error = new Error('Branch code is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(code)) {
    const error = new Error('Branch code must be 2-20 characters (letters, numbers, _ or -).');
    error.statusCode = 400;
    throw error;
  }
  return code.toUpperCase();
}

function normalizeBranchName(value) {
  const name = normalizeText(value);
  if (!name) {
    const error = new Error('Branch name is required.');
    error.statusCode = 400;
    throw error;
  }
  return name;
}

function normalizeActiveFlag(value) {
  if (value === undefined || value === null || value === '') {
    return 1;
  }
  if (value === true || value === 1 || value === '1') {
    return 1;
  }
  if (value === false || value === 0 || value === '0') {
    return 0;
  }
  const error = new Error('is_active must be a boolean-like value.');
  error.statusCode = 400;
  throw error;
}

function mapBranchRow(row) {
  if (!row) {
    return null;
  }
  return {
    branch_id: row.branch_id,
    branch_code: row.branch_code,
    branch_name: row.branch_name,
    address: row.address,
    is_active: row.is_active === 1 || row.is_active === true,
    created_at: row.created_at,
  };
}

async function listBranches({ activeOnly = false } = {}) {
  const queryParts = [
    `SELECT branch_id, branch_code, branch_name, address, is_active, created_at
     FROM branches`,
  ];

  if (activeOnly) {
    queryParts.push('WHERE is_active = 1');
  }

  queryParts.push('ORDER BY branch_name ASC, branch_id ASC');

  const [rows] = await getPool().query(queryParts.join('\n'));
  return rows.map(mapBranchRow);
}

async function getBranchById(branchId) {
  const [rows] = await getPool().query(
    `SELECT branch_id, branch_code, branch_name, address, is_active, created_at
     FROM branches
     WHERE branch_id = ?
     LIMIT 1`,
    [branchId],
  );
  return mapBranchRow(rows[0] || null);
}

async function findBranchByCode(branchCode) {
  const [rows] = await getPool().query(
    `SELECT branch_id, branch_code, branch_name, address, is_active, created_at
     FROM branches
     WHERE UPPER(branch_code) = UPPER(?)
     LIMIT 1`,
    [branchCode],
  );
  return mapBranchRow(rows[0] || null);
}

async function createBranch(payload) {
  const branch_code = normalizeBranchCode(payload.branch_code);
  const branch_name = normalizeBranchName(payload.branch_name);
  const address = normalizeText(payload.address);
  const is_active = normalizeActiveFlag(payload.is_active);

  const existing = await findBranchByCode(branch_code);
  if (existing) {
    const error = new Error('Branch code already exists.');
    error.statusCode = 409;
    throw error;
  }

  const [result] = await getPool().query(
    `INSERT INTO branches (branch_code, branch_name, address, is_active)
     VALUES (?, ?, ?, ?)`,
    [branch_code, branch_name, address, is_active],
  );

  const branchId = result.insertId;

  if (await tableExists('receipt_heading')) {
    const [existingHeading] = await getPool().query(
      `SELECT id FROM receipt_heading WHERE branch_id = ? LIMIT 1`,
      [branchId],
    );
    if (!existingHeading.length) {
      await getPool().query(
        `INSERT INTO receipt_heading (branch_id, busi_name, busi_addr, vat_rate)
         VALUES (?, ?, ?, 12)`,
        [branchId, branch_name, address],
      );
    }
  }

  return getBranchById(branchId);
}

async function updateBranch(branchId, payload) {
  const existing = await getBranchById(branchId);
  if (!existing) {
    return null;
  }

  const branch_code = payload.branch_code !== undefined
    ? normalizeBranchCode(payload.branch_code)
    : existing.branch_code;
  const branch_name = payload.branch_name !== undefined
    ? normalizeBranchName(payload.branch_name)
    : existing.branch_name;
  const address = payload.address !== undefined ? normalizeText(payload.address) : existing.address;
  const is_active = payload.is_active !== undefined
    ? normalizeActiveFlag(payload.is_active)
    : (existing.is_active ? 1 : 0);

  if (branch_code.toUpperCase() !== existing.branch_code.toUpperCase()) {
    const conflict = await findBranchByCode(branch_code);
    if (conflict && conflict.branch_id !== branchId) {
      const error = new Error('Branch code already exists.');
      error.statusCode = 409;
      throw error;
    }
  }

  if (is_active === 0) {
    const [userRows] = await getPool().query(
      `SELECT COUNT(*) AS count FROM users WHERE branch_id = ? AND ACTIVE = 1`,
      [branchId],
    );
    const [terminalRows] = await getPool().query(
      `SELECT COUNT(*) AS count FROM terminals_a WHERE branch_id = ? AND is_active = 1`,
      [branchId],
    );
    if (Number(userRows[0]?.count || 0) > 0 || Number(terminalRows[0]?.count || 0) > 0) {
      const error = new Error('Cannot deactivate a branch that still has active users or terminals.');
      error.statusCode = 409;
      throw error;
    }
  }

  await getPool().query(
    `UPDATE branches
     SET branch_code = ?, branch_name = ?, address = ?, is_active = ?
     WHERE branch_id = ?`,
    [branch_code, branch_name, address, is_active, branchId],
  );

  return getBranchById(branchId);
}

async function tableExists(tableName) {
  const [rows] = await getPool().query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName],
  );
  return rows.length > 0;
}

module.exports = {
  listBranches,
  getBranchById,
  findBranchByCode,
  createBranch,
  updateBranch,
  mapBranchRow,
};
