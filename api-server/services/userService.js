const crypto = require('crypto');
const { getPool } = require('../db');
const { getBranchById } = require('./branchService');

const USER_ROLES = ['Admin', 'Cashier', 'manager', 'Auditor'];

const USER_SELECT_SQL = `
  SELECT u.user_id,
         u.username,
         u.password_hash,
         u.role,
         u.full_name,
         u.ACTIVE,
         u.created_at,
         u.PAGE_ACCESS_JSON,
         u.branch_id,
         b.branch_code,
         b.branch_name
  FROM users u
  INNER JOIN branches b ON b.branch_id = u.branch_id
`;

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeRole(value) {
  const role = normalizeText(value);

  if (!role) {
    return 'Cashier';
  }

  if (!USER_ROLES.includes(role)) {
    const error = new Error(`Role must be one of: ${USER_ROLES.join(', ')}.`);
    error.statusCode = 400;
    throw error;
  }

  return role;
}

function isFullAccessAdminIdentity(username, role) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedRole = String(role || '').trim();

  return normalizedRole === 'Admin' && (normalizedUsername === 'admin' || normalizedUsername === 'administrator');
}

function toPageAccessObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_error) {
      // Fall through to defaults when incoming JSON is malformed.
    }
  }

  return null;
}

function normalizePageAccessJson(payload) {
  const parsed = toPageAccessObject(payload.PAGE_ACCESS_JSON);

  const pageAccess = {
    dashboard: Boolean(parsed?.dashboard),
    dashboardX: Boolean(parsed?.dashboardX),
    auditLogs: Boolean(parsed?.auditLogs),
    products: Boolean(parsed?.products),
    salesReport: Boolean(parsed?.salesReport),
    users: Boolean(parsed?.users),
    receiptHeading: Boolean(parsed?.receiptHeading),
    machineTerminalRegistration: Boolean(parsed?.machineTerminalRegistration),
    damageReports: Boolean(parsed?.damageReports),
    procurement: Boolean(parsed?.procurement),
    branches: Boolean(parsed?.branches),
  };

  return JSON.stringify(pageAccess);
}

function applyFullAccessIfAdmin(normalizedPayload) {
  if (!isFullAccessAdminIdentity(normalizedPayload.username, normalizedPayload.role)) {
    return normalizedPayload;
  }

  return {
    ...normalizedPayload,
    PAGE_ACCESS_JSON: JSON.stringify({
      dashboard: true,
      dashboardX: true,
      auditLogs: true,
      products: true,
      salesReport: true,
      users: true,
      receiptHeading: true,
      machineTerminalRegistration: true,
      damageReports: true,
      procurement: true,
      branches: true,
    }),
  };
}

function normalizeFlag(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  if (value === true || value === 1 || value === '1' || value === 'Y' || value === 'y') {
    return 1;
  }

  if (value === false || value === 0 || value === '0' || value === 'N' || value === 'n') {
    return 0;
  }

  const error = new Error(`${fieldName} must be a boolean-like value.`);
  error.statusCode = 400;
  throw error;
}

async function findUserByUsername(username) {
  const [rows] = await getPool().query(
    `${USER_SELECT_SQL}
     WHERE LOWER(u.username) = LOWER(?)
     LIMIT 1`,
    [username],
  );

  return rows[0] || null;
}

async function findUserById(userId) {
  const [rows] = await getPool().query(
    `${USER_SELECT_SQL}
     WHERE u.user_id = ?
     LIMIT 1`,
    [userId],
  );

  return rows[0] || null;
}

async function listUsers(branchId = null) {
  const queryParts = [
    `SELECT u.user_id,
            u.username,
            u.role,
            u.full_name,
            u.ACTIVE,
            u.created_at,
            u.PAGE_ACCESS_JSON,
            u.branch_id,
            b.branch_code,
            b.branch_name
     FROM users u
     INNER JOIN branches b ON b.branch_id = u.branch_id`,
  ];
  const params = [];

  if (branchId !== null && branchId !== undefined) {
    queryParts.push('WHERE u.branch_id = ?');
    params.push(branchId);
  }

  queryParts.push('ORDER BY u.user_id DESC');

  const [rows] = await getPool().query(queryParts.join('\n'), params);
  return rows;
}

async function findExistingUsername(username, excludeUserId = null) {
  const normalizedUsername = normalizeText(username);

  if (!normalizedUsername) {
    return null;
  }

  const queryParts = [
    `SELECT user_id, username
     FROM users
     WHERE LOWER(username) = LOWER(?)`,
  ];

  const params = [normalizedUsername];

  if (excludeUserId !== null && excludeUserId !== undefined) {
    queryParts.push('AND user_id <> ?');
    params.push(excludeUserId);
  }

  queryParts.push('LIMIT 1');

  const [rows] = await getPool().query(queryParts.join('\n'), params);
  return rows[0] || null;
}

function normalizeBranchId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error('A valid branch is required.');
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

async function assertBranchExists(branchId) {
  const branch = await getBranchById(branchId);
  if (!branch || !branch.is_active) {
    const error = new Error('Selected branch does not exist or is inactive.');
    error.statusCode = 400;
    throw error;
  }
  return branch;
}

function normalizeCreatePayload(payload) {
  const username = normalizeText(payload.username);
  const password = normalizeText(payload.password);

  if (!username) {
    const error = new Error('Username is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!password) {
    const error = new Error('Password is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = {
    username,
    password,
    role: normalizeRole(payload.role),
    full_name: normalizeText(payload.full_name),
    ACTIVE: normalizeFlag(payload.ACTIVE, 'ACTIVE'),
    branch_id: normalizeBranchId(payload.branch_id),
  };

  return applyFullAccessIfAdmin({
    ...normalized,
    PAGE_ACCESS_JSON: normalizePageAccessJson(payload),
  });
}

function normalizeUpdatePayload(payload) {
  const username = normalizeText(payload.username);

  if (!username) {
    const error = new Error('Username is required.');
    error.statusCode = 400;
    throw error;
  }

  const normalized = {
    username,
    password: normalizeText(payload.password),
    role: normalizeRole(payload.role),
    full_name: normalizeText(payload.full_name),
    ACTIVE: normalizeFlag(payload.ACTIVE, 'ACTIVE'),
  };

  if (payload.branch_id !== undefined && payload.branch_id !== null && payload.branch_id !== '') {
    normalized.branch_id = normalizeBranchId(payload.branch_id);
  }

  return applyFullAccessIfAdmin({
    ...normalized,
    PAGE_ACCESS_JSON: normalizePageAccessJson(payload),
  });
}

async function getUserByIdForManage(userId, branchId = null) {
  const queryParts = [
    `SELECT u.user_id,
            u.username,
            u.role,
            u.full_name,
            u.ACTIVE,
            u.created_at,
            u.PAGE_ACCESS_JSON,
            u.branch_id,
            b.branch_code,
            b.branch_name
     FROM users u
     INNER JOIN branches b ON b.branch_id = u.branch_id
     WHERE u.user_id = ?`,
  ];
  const params = [userId];

  if (branchId !== null && branchId !== undefined) {
    queryParts.push('AND u.branch_id = ?');
    params.push(branchId);
  }

  queryParts.push('LIMIT 1');

  const [rows] = await getPool().query(queryParts.join('\n'), params);
  return rows[0] || null;
}

async function createUser(payload) {
  const normalized = normalizeCreatePayload(payload || {});
  await assertBranchExists(normalized.branch_id);

  const existingUsername = await findExistingUsername(normalized.username);
  if (existingUsername) {
    const error = new Error('Username already exists.');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = hashPasswordSha256(normalized.password, 'utf8');

  const [result] = await getPool().query(
    `INSERT INTO users
      (username, password_hash, role, full_name, ACTIVE, PAGE_ACCESS_JSON, branch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      normalized.username,
      passwordHash,
      normalized.role,
      normalized.full_name,
      normalized.ACTIVE,
      normalized.PAGE_ACCESS_JSON,
      normalized.branch_id,
    ],
  );

  return getUserByIdForManage(result.insertId);
}

async function updateUser(userId, payload, branchId = null) {
  const normalized = normalizeUpdatePayload(payload || {});
  const existing = await getUserByIdForManage(userId, branchId);

  if (!existing) {
    return null;
  }

  if (normalized.branch_id !== undefined) {
    await assertBranchExists(normalized.branch_id);
  }

  const usernameConflict = await findExistingUsername(normalized.username, userId);
  if (usernameConflict) {
    const error = new Error('Username already exists.');
    error.statusCode = 409;
    throw error;
  }

  const nextBranchId = normalized.branch_id !== undefined ? normalized.branch_id : existing.branch_id;

  if (normalized.password) {
    const passwordHash = hashPasswordSha256(normalized.password, 'utf8');
    await getPool().query(
      `UPDATE users
       SET username = ?,
           password_hash = ?,
           role = ?,
           full_name = ?,
           ACTIVE = ?,
           PAGE_ACCESS_JSON = ?,
           branch_id = ?
       WHERE user_id = ?`,
      [
        normalized.username,
        passwordHash,
        normalized.role,
        normalized.full_name,
        normalized.ACTIVE,
        normalized.PAGE_ACCESS_JSON,
        nextBranchId,
        userId,
      ],
    );
  } else {
    await getPool().query(
      `UPDATE users
       SET username = ?,
           role = ?,
           full_name = ?,
           ACTIVE = ?,
           PAGE_ACCESS_JSON = ?,
           branch_id = ?
       WHERE user_id = ?`,
      [
        normalized.username,
        normalized.role,
        normalized.full_name,
        normalized.ACTIVE,
        normalized.PAGE_ACCESS_JSON,
        nextBranchId,
        userId,
      ],
    );
  }

  return getUserByIdForManage(userId, branchId);
}

async function deleteUser(userId, branchId = null) {
  const queryParts = ['DELETE FROM users WHERE user_id = ?'];
  const params = [userId];

  if (branchId !== null && branchId !== undefined) {
    queryParts.push('AND branch_id = ?');
    params.push(branchId);
  }

  const [result] = await getPool().query(queryParts.join(' '), params);
  return result.affectedRows > 0;
}

function hashPasswordSha256(password, encoding = 'utf8') {
  return crypto.createHash('sha256').update(password, encoding).digest('hex');
}

function passwordsMatch(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  const normalizedStoredHash = String(storedHash).trim().toLowerCase();
  const variants = [password, password.trim()];

  for (const variant of variants) {
    const utf8Hash = hashPasswordSha256(variant, 'utf8').toLowerCase();
    const utf16leHash = hashPasswordSha256(variant, 'utf16le').toLowerCase();

    if (utf8Hash === normalizedStoredHash || utf16leHash === normalizedStoredHash) {
      return true;
    }
  }

  return false;
}

function isUserActive(value) {
  return value === true || value === 1 || value === '1' || value === 'Y' || value === 'y';
}

function parsePageAccessJson(value) {
  const parsed = toPageAccessObject(value);

  return {
    dashboard: Boolean(parsed?.dashboard),
    dashboardX: Boolean(parsed?.dashboardX),
    auditLogs: Boolean(parsed?.auditLogs),
    products: Boolean(parsed?.products),
    salesReport: Boolean(parsed?.salesReport),
    users: Boolean(parsed?.users),
    receiptHeading: Boolean(parsed?.receiptHeading),
    machineTerminalRegistration: Boolean(parsed?.machineTerminalRegistration),
    damageReports: Boolean(parsed?.damageReports),
    procurement: Boolean(parsed?.procurement),
    branches: Boolean(parsed?.branches),
  };
}

function toSessionUser(user) {
  const isFullAccessAdmin = isFullAccessAdminIdentity(user?.username, user?.role);
  const pageAccess = isFullAccessAdmin
    ? {
      dashboard: true,
      dashboardX: true,
      auditLogs: true,
      products: true,
      salesReport: true,
      users: true,
      receiptHeading: true,
      machineTerminalRegistration: true,
      damageReports: true,
      procurement: true,
      branches: true,
    }
    : parsePageAccessJson(user?.PAGE_ACCESS_JSON);

  return {
    userId: user.user_id,
    username: user.username,
    role: user.role,
    fullName: user.full_name,
    active: isUserActive(user.ACTIVE),
    createdAt: user.created_at,
    branchId: user.branch_id,
    branchCode: user.branch_code,
    branchName: user.branch_name,
    pageAccess,
  };
}

module.exports = {
  USER_ROLES,
  listUsers,
  findExistingUsername,
  getUserByIdForManage,
  createUser,
  updateUser,
  deleteUser,
  findUserById,
  findUserByUsername,
  passwordsMatch,
  isUserActive,
  toSessionUser,
};