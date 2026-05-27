const { getPool } = require('../db');

function resolveIpAddress(request) {
  const forwarded = request.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return request.ip || null;
}

function resolveTableName(request) {
  const auditTable = request.headers['x-audit-table'];
  if (typeof auditTable === 'string' && auditTable.trim()) {
    return auditTable.trim().slice(0, 255);
  }

  if (request.params && request.params.tableName) {
    return String(request.params.tableName).slice(0, 255);
  }

  if (typeof request.body?.table_name === 'string') {
    return request.body.table_name.slice(0, 255);
  }

  return null;
}

function resolveProductBarcode(request) {
  const auditBarcode = request.headers['x-audit-barcode'];
  if (typeof auditBarcode === 'string' && auditBarcode.trim()) {
    return auditBarcode.trim().slice(0, 255);
  }

  const value = request.body?.product_barcode || request.body?.barcode || request.query?.barcode;

  if (!value) {
    return null;
  }

  return String(value).slice(0, 255);
}

function resolveAuditHeaders(request) {
  const page = request.headers['x-audit-page'];
  const action = request.headers['x-audit-action'];
  const description = request.headers['x-audit-description'];

  if (typeof page !== 'string' || !page.trim()) {
    return null;
  }

  return {
    page: page.trim().slice(0, 255),
    action: (typeof action === 'string' && action.trim() ? action.trim() : 'ACTION').slice(0, 255),
    description: (typeof description === 'string' && description.trim()
      ? description.trim()
      : `Page: ${page.trim()}.`).slice(0, 2000),
  };
}

function shouldSkipAutomaticAudit(request, response) {
  if (response.statusCode === 304) {
    return true;
  }

  if (response.statusCode >= 500) {
    return true;
  }

  const path = request.path || '';

  if (path.startsWith('/audit-logs')) {
    return true;
  }

  if (path === '/auth/me') {
    return true;
  }

  return false;
}

async function insertAuditLog({
  userId,
  username,
  actionType,
  tableName,
  productBarcode,
  description,
  machineId,
  ptuNumber,
  ipAddress,
  deviceInfo,
}) {
  await getPool().query(
    `INSERT INTO audit_logs
     (user_id, username, action_type, table_name, product_barcode, description, machineid, ptunumber, ip_address, device_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      username.slice(0, 255),
      actionType,
      tableName,
      productBarcode,
      description,
      machineId,
      ptuNumber,
      ipAddress,
      deviceInfo,
    ],
  );
}

async function logAuditAction(request, response) {
  if (shouldSkipAutomaticAudit(request, response)) {
    return;
  }

  const audit = resolveAuditHeaders(request);
  if (!audit) {
    return;
  }

  const user = request.session?.user;
  const userId = user?.userId ? String(user.userId) : 'SYSTEM';
  const username = user?.username ? String(user.username) : 'SYSTEM';
  const tableName = resolveTableName(request);
  const productBarcode = resolveProductBarcode(request);
  const machineId = String(request.headers['x-machine-id'] || 'N/A').slice(0, 255);
  const ptuNumber = String(request.headers['x-ptu-number'] || 'N/A').slice(0, 255);
  const ipAddress = resolveIpAddress(request);
  const deviceInfo = String(request.headers['user-agent'] || 'Unknown device');

  await insertAuditLog({
    userId,
    username,
    actionType: audit.action,
    tableName,
    productBarcode,
    description: audit.description,
    machineId,
    ptuNumber,
    ipAddress,
    deviceInfo,
  });
}

async function recordClientAudit(request) {
  const user = request.session?.user;
  const userId = user?.userId ? String(user.userId) : 'SYSTEM';
  const username = user?.username ? String(user.username) : 'SYSTEM';
  const page = String(request.body?.page || '').trim();
  const action = String(request.body?.action || 'VIEW PAGE').trim();
  const description = String(request.body?.description || '').trim();
  const tableName = request.body?.table_name ? String(request.body.table_name).slice(0, 255) : null;
  const productBarcode = request.body?.product_barcode
    ? String(request.body.product_barcode).slice(0, 255)
    : null;
  const machineId = String(request.headers['x-machine-id'] || 'N/A').slice(0, 255);
  const ptuNumber = String(request.headers['x-ptu-number'] || 'N/A').slice(0, 255);
  const ipAddress = resolveIpAddress(request);
  const deviceInfo = String(request.headers['user-agent'] || 'Unknown device');

  if (!page) {
    const error = new Error('Audit page is required.');
    error.statusCode = 400;
    throw error;
  }

  const resolvedDescription = description || `Page: ${page}.`;

  await insertAuditLog({
    userId,
    username,
    actionType: action.slice(0, 255),
    tableName,
    productBarcode,
    description: resolvedDescription.slice(0, 2000),
    machineId,
    ptuNumber,
    ipAddress,
    deviceInfo,
  });
}

module.exports = {
  logAuditAction,
  recordClientAudit,
};
