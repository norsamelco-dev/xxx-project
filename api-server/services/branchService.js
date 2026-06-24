const fs = require('fs/promises');
const path = require('path');
const { getPool } = require('../db');
const {
  BRANCH_SCOPED_DELETE_ORDER,
  columnExists,
  tableExists,
} = require('../db/ensureBranchSchema');
const {
  normalizeBusinessProfilePayload,
  normalizeText,
  mapBusinessProfileRow,
} = require('../utils/businessProfile');

const LOGOS_DIR = path.resolve(__dirname, '..', 'api', 'logos');
const PRODUCT_IMAGES_DIR = path.resolve(__dirname, '..', 'api', 'product-images');
const LOGOS_PUBLIC_PREFIX = '/api/logos/';
const PRODUCT_IMAGES_PUBLIC_PREFIX = '/api/product-images/';

const BRANCH_SELECT_COLUMNS = `
  branch_id, branch_code, branch_name, address, is_active, created_at,
  busi_name, busi_addr, busi_owner, busi_vat_type, busi_tin, vat_rate, price_vat_mode, business_logo_path
`;

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

function resolveBusinessProfile(payload, { branchName, address, existing = null, requireName = false }) {
  const merged = {
    busi_name: payload.busi_name !== undefined ? payload.busi_name : (existing?.busi_name ?? branchName),
    busi_addr: payload.busi_addr !== undefined ? payload.busi_addr : (existing?.busi_addr ?? address),
    busi_owner: payload.busi_owner !== undefined ? payload.busi_owner : existing?.busi_owner,
    busi_vat_type: payload.busi_vat_type !== undefined ? payload.busi_vat_type : existing?.busi_vat_type,
    busi_tin: payload.busi_tin !== undefined ? payload.busi_tin : existing?.busi_tin,
    vat_rate: payload.vat_rate !== undefined ? payload.vat_rate : existing?.vat_rate,
    price_vat_mode: payload.price_vat_mode !== undefined ? payload.price_vat_mode : existing?.price_vat_mode,
    business_logo_path:
      payload.business_logo_path !== undefined ? payload.business_logo_path : existing?.business_logo_path,
  };

  return normalizeBusinessProfilePayload(merged, { requireName });
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
    ...mapBusinessProfileRow(row),
  };
}

function toPublicBranchBusinessProfile(branch) {
  if (!branch) {
    return null;
  }

  return {
    branch_id: branch.branch_id,
    branch_code: branch.branch_code,
    branch_name: branch.branch_name,
    busi_name: branch.busi_name ?? null,
    busi_addr: branch.busi_addr ?? null,
    busi_owner: branch.busi_owner ?? null,
    busi_vat_type: branch.busi_vat_type ?? null,
    busi_tin: branch.busi_tin ?? null,
    vat_rate: branch.vat_rate ?? null,
    price_vat_mode: branch.price_vat_mode ?? 'INCLUSIVE',
    business_logo_path: branch.business_logo_path ?? null,
  };
}

async function getBranchBusinessProfileById(branchId) {
  const branch = await getBranchById(branchId);
  return toPublicBranchBusinessProfile(branch);
}

async function listBranches({ activeOnly = false } = {}) {
  const queryParts = [
    `SELECT ${BRANCH_SELECT_COLUMNS}
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
    `SELECT ${BRANCH_SELECT_COLUMNS}
     FROM branches
     WHERE branch_id = ?
     LIMIT 1`,
    [branchId],
  );
  return mapBranchRow(rows[0] || null);
}

async function findBranchByCode(branchCode) {
  const [rows] = await getPool().query(
    `SELECT ${BRANCH_SELECT_COLUMNS}
     FROM branches
     WHERE UPPER(branch_code) = UPPER(?)
     LIMIT 1`,
    [branchCode],
  );
  return mapBranchRow(rows[0] || null);
}

async function generateBranchCode() {
  const [rows] = await getPool().query(
    `SELECT branch_code
     FROM branches
     WHERE UPPER(branch_code) REGEXP '^BR[0-9]+$'`,
  );

  let maxSequence = 0;
  for (const row of rows) {
    const match = /^BR(\d+)$/i.exec(String(row.branch_code || '').trim());
    if (match) {
      maxSequence = Math.max(maxSequence, Number(match[1]));
    }
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = `BR${String(maxSequence + 1 + attempt).padStart(3, '0')}`;
    const existing = await findBranchByCode(candidate);
    if (!existing) {
      return candidate;
    }
  }

  const error = new Error('Unable to generate a unique branch code.');
  error.statusCode = 500;
  throw error;
}

async function ensureReceiptHeadingRow(branchId) {
  if (!(await tableExists('receipt_heading'))) {
    return;
  }

  const [existingHeading] = await getPool().query(
    `SELECT id FROM receipt_heading WHERE branch_id = ? LIMIT 1`,
    [branchId],
  );

  if (existingHeading.length) {
    return;
  }

  await getPool().query(
    `INSERT INTO receipt_heading (branch_id, developer)
     VALUES (?, 'N/A')`,
    [branchId],
  );
}

async function createBranch(payload) {
  const branch_code = normalizeText(payload.branch_code)
    ? normalizeBranchCode(payload.branch_code)
    : await generateBranchCode();
  const branch_name = normalizeBranchName(payload.branch_name);
  const address = normalizeText(payload.address);
  const is_active = normalizeActiveFlag(payload.is_active);
  const business = resolveBusinessProfile(payload, {
    branchName: branch_name,
    address,
    requireName: false,
  });

  if (!business.busi_name) {
    business.busi_name = branch_name;
  }

  const existing = await findBranchByCode(branch_code);
  if (existing) {
    const error = new Error('Branch code already exists.');
    error.statusCode = 409;
    throw error;
  }

  const [result] = await getPool().query(
    `INSERT INTO branches (
       branch_code, branch_name, address, is_active,
       busi_name, busi_addr, busi_owner, busi_vat_type, busi_tin, vat_rate, price_vat_mode, business_logo_path
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      branch_code,
      branch_name,
      address,
      is_active,
      business.busi_name,
      business.busi_addr,
      business.busi_owner,
      business.busi_vat_type,
      business.busi_tin,
      business.vat_rate ?? 12,
      business.price_vat_mode,
      business.business_logo_path,
    ],
  );

  const branchId = result.insertId;
  await ensureReceiptHeadingRow(branchId);

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

  const business = resolveBusinessProfile(payload, {
    branchName: branch_name,
    address,
    existing,
    requireName: true,
  });

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
     SET branch_code = ?,
         branch_name = ?,
         address = ?,
         is_active = ?,
         busi_name = ?,
         busi_addr = ?,
         busi_owner = ?,
         busi_vat_type = ?,
         busi_tin = ?,
         vat_rate = ?,
         price_vat_mode = ?,
         business_logo_path = ?
     WHERE branch_id = ?`,
    [
      branch_code,
      branch_name,
      address,
      is_active,
      business.busi_name,
      business.busi_addr,
      business.busi_owner,
      business.busi_vat_type,
      business.busi_tin,
      business.vat_rate ?? 12,
      business.price_vat_mode,
      business.business_logo_path,
      branchId,
    ],
  );

  return getBranchById(branchId);
}

function toAbsoluteProductImagePath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') {
    return null;
  }

  if (!publicPath.startsWith(PRODUCT_IMAGES_PUBLIC_PREFIX)) {
    return null;
  }

  const fileName = path.basename(publicPath);
  return fileName ? path.join(PRODUCT_IMAGES_DIR, fileName) : null;
}

function toAbsoluteLogoPath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') {
    return null;
  }

  if (!publicPath.startsWith(LOGOS_PUBLIC_PREFIX)) {
    return null;
  }

  const fileName = path.basename(publicPath);
  return fileName ? path.join(LOGOS_DIR, fileName) : null;
}

async function unlinkIfExists(absolutePath) {
  if (!absolutePath) {
    return;
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function collectBranchAssetPaths(branchId, executor = null) {
  const queryTarget = executor || getPool();
  const productImages = [];
  const receiptLogoPaths = [];

  if (await tableExists('products', queryTarget) && await columnExists('products', 'product_image_path', queryTarget)) {
    const [rows] = await queryTarget.query(
      `SELECT product_image_path
       FROM products
       WHERE branch_id = ?
         AND product_image_path IS NOT NULL
         AND product_image_path <> ''`,
      [branchId],
    );

    for (const row of rows) {
      if (row.product_image_path) {
        productImages.push(row.product_image_path);
      }
    }
  }

  if (await columnExists('branches', 'business_logo_path', queryTarget)) {
    const [branchRows] = await queryTarget.query(
      `SELECT business_logo_path
       FROM branches
       WHERE branch_id = ?
       LIMIT 1`,
      [branchId],
    );

    if (branchRows[0]?.business_logo_path) {
      receiptLogoPaths.push(branchRows[0].business_logo_path);
    }
  }

  if (await tableExists('receipt_heading', queryTarget)) {
    const [rows] = await queryTarget.query(
      `SELECT developer_logo_path
       FROM receipt_heading
       WHERE branch_id = ?
       LIMIT 1`,
      [branchId],
    );

    if (rows[0]?.developer_logo_path) {
      receiptLogoPaths.push(rows[0].developer_logo_path);
    }
  }

  return { productImages, receiptLogoPaths };
}

async function isLogoPathReferenced(logoPath) {
  if (!logoPath) {
    return false;
  }

  if (await tableExists('branches') && await columnExists('branches', 'business_logo_path')) {
    const [branchRows] = await getPool().query(
      `SELECT COUNT(*) AS count
       FROM branches
       WHERE business_logo_path = ?`,
      [logoPath],
    );

    if (Number(branchRows[0]?.count || 0) > 0) {
      return true;
    }
  }

  if (!(await tableExists('receipt_heading'))) {
    return false;
  }

  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS count
     FROM receipt_heading
     WHERE developer_logo_path = ?`,
    [logoPath],
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function deleteBranchAssetFiles(assetPaths) {
  const uniqueProductImages = [...new Set(assetPaths.productImages)];
  const uniqueLogoPaths = [...new Set(assetPaths.receiptLogoPaths)];

  for (const publicPath of uniqueProductImages) {
    await unlinkIfExists(toAbsoluteProductImagePath(publicPath));
  }

  for (const publicPath of uniqueLogoPaths) {
    if (await isLogoPathReferenced(publicPath)) {
      continue;
    }
    await unlinkIfExists(toAbsoluteLogoPath(publicPath));
  }
}

async function countBranchScopedRows(branchId, executor = null) {
  const queryTarget = executor || getPool();
  const counts = {};

  for (const tableName of BRANCH_SCOPED_DELETE_ORDER) {
    if (!(await tableExists(tableName, queryTarget))) {
      continue;
    }

    if (!(await columnExists(tableName, 'branch_id', queryTarget))) {
      continue;
    }

    const [rows] = await queryTarget.query(
      `SELECT COUNT(*) AS count FROM ?? WHERE branch_id = ?`,
      [tableName, branchId],
    );
    counts[tableName] = Number(rows[0]?.count || 0);
  }

  return counts;
}

async function assertBranchScopedRowsCleared(branchId) {
  const counts = await countBranchScopedRows(branchId);
  const remaining = Object.entries(counts).filter(([, count]) => count > 0);

  if (remaining.length > 0) {
    const summary = remaining.map(([tableName, count]) => `${tableName}(${count})`).join(', ');
    const error = new Error(`Branch delete left rows in: ${summary}`);
    error.statusCode = 500;
    throw error;
  }
}

async function deleteBranchScopedRows(connection, branchId) {
  for (const tableName of BRANCH_SCOPED_DELETE_ORDER) {
    if (!(await tableExists(tableName, connection))) {
      continue;
    }

    if (!(await columnExists(tableName, 'branch_id', connection))) {
      continue;
    }

    await connection.query(`DELETE FROM ?? WHERE branch_id = ?`, [tableName, branchId]);
  }
}

async function deleteBranch(branchId) {
  const existing = await getBranchById(branchId);
  if (!existing) {
    return null;
  }

  const [branchCountRows] = await getPool().query(`SELECT COUNT(*) AS count FROM branches`);
  if (Number(branchCountRows[0]?.count || 0) <= 1) {
    const error = new Error('Cannot delete the last remaining branch.');
    error.statusCode = 409;
    throw error;
  }

  const assetPaths = await collectBranchAssetPaths(branchId);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await deleteBranchScopedRows(connection, branchId);

    const [result] = await connection.query(`DELETE FROM branches WHERE branch_id = ?`, [branchId]);
    if (!result.affectedRows) {
      await connection.rollback();
      return null;
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await assertBranchScopedRowsCleared(branchId);
  await deleteBranchAssetFiles(assetPaths);

  return existing;
}

module.exports = {
  listBranches,
  getBranchById,
  findBranchByCode,
  generateBranchCode,
  createBranch,
  updateBranch,
  deleteBranch,
  countBranchScopedRows,
  mapBranchRow,
  toPublicBranchBusinessProfile,
  getBranchBusinessProfileById,
};
