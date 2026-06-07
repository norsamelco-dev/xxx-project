const { getPool } = require('../db');

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    const error = new Error(`${fieldName} must be a whole number.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function normalizeDate(value, fieldName) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(text);

  if (!isValid) {
    const error = new Error(`${fieldName} must be in YYYY-MM-DD format.`);
    error.statusCode = 400;
    throw error;
  }

  return text;
}

function normalizeActive(value) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  return value ? 1 : 0;
}

function normalizePayload(payload) {
  return {
    machine_name: normalizeText(payload.machine_name),
    serial_number: normalizeText(payload.serial_number),
    min_number: normalizeText(payload.min_number),
    ptu_number: normalizeText(payload.ptu_number),
    or_start: normalizeInteger(payload.or_start, 'or_start'),
    or_end: normalizeInteger(payload.or_end, 'or_end'),
    current_or: normalizeInteger(payload.current_or, 'current_or'),
    valid_start: normalizeDate(payload.valid_start, 'valid_start'),
    valid_end: normalizeDate(payload.valid_end, 'valid_end'),
    is_active: normalizeActive(payload.is_active),
  };
}

const duplicateFieldDefinitions = [
  { field: 'machine_name', label: 'MachineName', column: 'machine_name' },
  { field: 'serial_number', label: 'SerialNumber', column: 'serial_number' },
  { field: 'min_number', label: 'MachineIdentificationNumber', column: 'min_number' },
  { field: 'ptu_number', label: 'PermitToUseNumber', column: 'ptu_number' },
  { field: 'or_start', label: 'OR_Start', column: 'or_start' },
  { field: 'or_end', label: 'OR_End', column: 'or_end' },
];

function buildDuplicateError(duplicates) {
  const error = new Error('Duplicate values detected.');
  error.statusCode = 409;
  error.duplicates = duplicates;
  return error;
}

async function findDuplicateFields(branchId, payload, excludeId) {
  const normalized = normalizePayload(payload || {});
  const validExcludeId = Number.isInteger(Number(excludeId)) && Number(excludeId) > 0 ? Number(excludeId) : null;

  const results = await Promise.all(
    duplicateFieldDefinitions.map(async ({ field, label, column }) => {
      const value = normalized[field];

      if (value === null || value === undefined || value === '') {
        return null;
      }

      const params = validExcludeId ? [branchId, value, validExcludeId] : [branchId, value];
      const exclusionClause = validExcludeId ? 'AND ID <> ?' : '';
      const [rows] = await getPool().query(
        `SELECT ID
         FROM terminals_a
         WHERE branch_id = ?
           AND ${column} = ?
         ${exclusionClause}
         LIMIT 1`,
        params,
      );

      if (rows.length > 0) {
        return { field, label, value, matchId: rows[0].ID };
      }

      return null;
    }),
  );

  return results.filter(Boolean);
}

async function listMachines(branchId) {
  const [rows] = await getPool().query(
    `SELECT ID, machine_name, serial_number, min_number, ptu_number,
            or_start, or_end, current_or, valid_start, valid_end, is_active,
            created_at, updated_at, branch_id
     FROM terminals_a
     WHERE branch_id = ?
     ORDER BY ID ASC`,
    [branchId],
  );

  return rows;
}

async function createMachine(branchId, payload) {
  const normalized = normalizePayload(payload || {});
  const duplicates = await findDuplicateFields(branchId, normalized);

  if (duplicates.length > 0) {
    throw buildDuplicateError(duplicates);
  }

  const [result] = await getPool().query(
    `INSERT INTO terminals_a
      (machine_name, serial_number, min_number, ptu_number,
       or_start, or_end, current_or, valid_start, valid_end, is_active,
       created_at, updated_at, branch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
    [
      normalized.machine_name,
      normalized.serial_number,
      normalized.min_number,
      normalized.ptu_number,
      normalized.or_start,
      normalized.or_end,
      normalized.current_or,
      normalized.valid_start,
      normalized.valid_end,
      normalized.is_active,
      branchId,
    ],
  );

  const [rows] = await getPool().query(
    `SELECT ID, machine_name, serial_number, min_number, ptu_number,
            or_start, or_end, current_or, valid_start, valid_end, is_active,
            created_at, updated_at, branch_id
     FROM terminals_a
     WHERE ID = ?
       AND branch_id = ?`,
    [result.insertId, branchId],
  );

  return rows[0] || null;
}

async function updateMachine(branchId, id, payload) {
  const normalized = normalizePayload(payload || {});
  const duplicates = await findDuplicateFields(branchId, normalized, id);

  if (duplicates.length > 0) {
    throw buildDuplicateError(duplicates);
  }

  const [result] = await getPool().query(
    `UPDATE terminals_a
     SET machine_name = ?,
         serial_number = ?,
         min_number = ?,
         ptu_number = ?,
         or_start = ?,
         or_end = ?,
         current_or = ?,
         valid_start = ?,
         valid_end = ?,
         is_active = ?,
         updated_at = NOW()
     WHERE ID = ?
       AND branch_id = ?`,
    [
      normalized.machine_name,
      normalized.serial_number,
      normalized.min_number,
      normalized.ptu_number,
      normalized.or_start,
      normalized.or_end,
      normalized.current_or,
      normalized.valid_start,
      normalized.valid_end,
      normalized.is_active,
      id,
      branchId,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await getPool().query(
    `SELECT ID, machine_name, serial_number, min_number, ptu_number,
            or_start, or_end, current_or, valid_start, valid_end, is_active,
            created_at, updated_at, branch_id
     FROM terminals_a
     WHERE ID = ?
       AND branch_id = ?`,
    [id, branchId],
  );

  return rows[0] || null;
}

async function deleteMachine(branchId, id) {
  const [result] = await getPool().query(
    'DELETE FROM terminals_a WHERE ID = ? AND branch_id = ?',
    [id, branchId],
  );
  return result.affectedRows > 0;
}

module.exports = {
  listMachines,
  findDuplicateFields,
  createMachine,
  updateMachine,
  deleteMachine,
};
