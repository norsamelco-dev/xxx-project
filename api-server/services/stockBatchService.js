const { randomUUID } = require('crypto');
const { getPool } = require('../db');

const STOCK_BATCH_SYNC_HISTORY_TABLE = 'product_batches_sync_history';

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(`${fieldName} is required.`);
    error.statusCode = 400;
    throw error;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} must be a whole number greater than zero.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function normalizeDecimal(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(`${fieldName} is required.`);
    error.statusCode = 400;
    throw error;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(`${fieldName} must be a valid number equal to or greater than zero.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function normalizeExpiration(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    const error = new Error('Expiration must be a valid date.');
    error.statusCode = 400;
    throw error;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateFilter(value, fieldName) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format.`);
    error.statusCode = 400;
    throw error;
  }

  const parsed = new Date(`${text}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} is not a valid date.`);
    error.statusCode = 400;
    throw error;
  }

  return text;
}

async function ensureStockBatchSyncHistoryTable(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${STOCK_BATCH_SYNC_HISTORY_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      sync_batch_id VARCHAR(64) NOT NULL,
      sync_code VARCHAR(20) DEFAULT NULL,
      sync_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      user_id VARCHAR(45) DEFAULT NULL,
      username VARCHAR(255) DEFAULT NULL,
      product_barcode VARCHAR(100) DEFAULT NULL,
      product_name VARCHAR(500) DEFAULT NULL,
      batch_id VARCHAR(100) DEFAULT NULL,
      qty_before INT NOT NULL DEFAULT 0,
      qty_added INT NOT NULL DEFAULT 0,
      qty_after INT NOT NULL DEFAULT 0,
      cost_price DECIMAL(10,2) DEFAULT NULL,
      selling_price DECIMAL(10,2) DEFAULT NULL,
      expiration_date DATE DEFAULT NULL,
      source VARCHAR(40) NOT NULL DEFAULT 'batch_sync',
      PRIMARY KEY (id),
      KEY idx_sync_timestamp (sync_timestamp),
      KEY idx_sync_code (sync_code),
      KEY idx_product_barcode (product_barcode),
      KEY idx_user_id (user_id),
      KEY idx_sync_batch_id (sync_batch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  const databaseName = String(process.env.DB_NAME || '').trim();

  if (!databaseName) {
    return;
  }

  const [columnRows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = 'sync_code'
     LIMIT 1`,
    [databaseName, STOCK_BATCH_SYNC_HISTORY_TABLE],
  );

  if (columnRows.length === 0) {
    await connection.query(
      `ALTER TABLE ${STOCK_BATCH_SYNC_HISTORY_TABLE}
       ADD COLUMN sync_code VARCHAR(20) DEFAULT NULL AFTER sync_batch_id`,
    );
  }

  const [indexRows] = await connection.query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND INDEX_NAME = 'idx_sync_code'
     LIMIT 1`,
    [databaseName, STOCK_BATCH_SYNC_HISTORY_TABLE],
  );

  if (indexRows.length === 0) {
    await connection.query(
      `ALTER TABLE ${STOCK_BATCH_SYNC_HISTORY_TABLE}
       ADD KEY idx_sync_code (sync_code)`,
    );
  }
}

async function buildDailySyncCode(connection, branchId) {
  const [dateRows] = await connection.query(`SELECT DATE_FORMAT(NOW(), '%Y%m%d') AS day_code`);
  const dayCode = String(dateRows[0]?.day_code || '');

  if (!dayCode) {
    const error = new Error('Unable to generate sync code date prefix.');
    error.statusCode = 500;
    throw error;
  }

  const [sequenceRows] = await connection.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(sync_code, '_', -1) AS UNSIGNED)), 0) AS max_sequence
     FROM ${STOCK_BATCH_SYNC_HISTORY_TABLE}
     WHERE sync_code LIKE ?
       AND branch_id = ?`,
    [`${dayCode}_%`, branchId],
  );

  const nextSequence = Number(sequenceRows[0]?.max_sequence || 0) + 1;
  return `${dayCode}_${String(nextSequence).padStart(3, '0')}`;
}

async function buildBatchId(inputBatchId, productBarcode, branchId) {
  const normalizedBatchId = normalizeText(inputBatchId);

  if (normalizedBatchId) {
    return normalizedBatchId;
  }

  const normalizedBarcode = normalizeText(productBarcode);

  if (!normalizedBarcode) {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `TMP-${timestamp}`;
  }

  const [rows] = await getPool().query(
    `SELECT COUNT(DISTINCT batch_id) AS batchCount
     FROM product_batches
     WHERE product_barcode = ?
       AND branch_id = ?
       AND batch_id IS NOT NULL
       AND TRIM(batch_id) <> ''`,
    [normalizedBarcode, branchId],
  );

  const count = Number(rows[0]?.batchCount || 0);
  const nextBatchNumber = count + 1;
  return `B-${String(nextBatchNumber).padStart(3, '0')}`;
}

async function listStockBatchProducts(branchId) {
  const [rows] = await getPool().query(
    `SELECT product_id,
            product_barcode,
            product_name,
            category,
            brand,
            product_image_path,
            unit
     FROM products
     WHERE branch_id = ?
       AND product_barcode IS NOT NULL
       AND TRIM(product_barcode) <> ''
     ORDER BY product_name ASC, product_barcode ASC`,
    [branchId],
  );

  return rows;
}

async function findStockBatchProductByBarcode(barcode, branchId) {
  const normalizedBarcode = normalizeText(barcode);

  if (!normalizedBarcode) {
    return null;
  }

  const [rows] = await getPool().query(
    `SELECT product_id,
            product_barcode,
            product_name,
            category,
            brand,
            product_image_path,
            unit
     FROM products
     WHERE product_barcode = ?
       AND branch_id = ?
     LIMIT 1`,
    [normalizedBarcode, branchId],
  );

  return rows[0] || null;
}

async function resolveTemplateTableName() {
  const databaseName = String(process.env.DB_NAME || '').trim();

  if (!databaseName) {
    const error = new Error('DB_NAME is required to resolve stock batch template table.');
    error.statusCode = 500;
    throw error;
  }

  const [rows] = await getPool().query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME IN ('product_batches_templates', 'product_batches_template')
     ORDER BY FIELD(TABLE_NAME, 'product_batches_templates', 'product_batches_template')`,
    [databaseName],
  );

  if (rows.length === 0) {
    const error = new Error('Stock batch template table was not found (expected product_batches_templates or product_batches_template).');
    error.statusCode = 500;
    throw error;
  }

  return rows[0].TABLE_NAME;
}

async function createStockBatchTemplate(payload, sessionUser, branchId) {
  const templateTableName = await resolveTemplateTableName();
  const barcode = normalizeText(payload.barcode);
  const qty = normalizeInteger(payload.qty, 'Quantity');
  const costPrice = normalizeDecimal(payload.costPrice, 'Cost price');
  const sellingPrice = normalizeDecimal(payload.sellingPrice, 'Selling price');
  const expiration = normalizeExpiration(payload.expiration);

  if (!barcode) {
    const error = new Error('Product barcode is required.');
    error.statusCode = 400;
    throw error;
  }

  const product = await findStockBatchProductByBarcode(barcode, branchId);

  if (!product) {
    const error = new Error('Selected product was not found. Please add the product first.');
    error.statusCode = 404;
    throw error;
  }

  const batchId = await buildBatchId(payload.batchId, product.product_barcode, branchId);

  const userId = normalizeText(sessionUser?.userId);

  const [result] = await getPool().query(
    `INSERT INTO ${templateTableName}
      (BatchID, CATEGORY, BARCODE, DESCRIPTION, BRAND, UNIT, QTY, COSTPRICE, SELLINGPRICE, EXPIRATION, USERID, branch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batchId,
      normalizeText(product.category),
      product.product_barcode,
      normalizeText(product.product_name),
      normalizeText(product.brand),
      normalizeText(product.unit),
      qty,
      costPrice,
      sellingPrice,
      expiration,
      userId,
      branchId,
    ],
  );

  const [rows] = await getPool().query(
    `SELECT ID,
            BatchID,
            CATEGORY,
            BARCODE,
            DESCRIPTION,
            BRAND,
            (
              SELECT p.product_image_path
              FROM products p
              WHERE p.product_barcode = ${templateTableName}.BARCODE
                AND p.branch_id = ?
              LIMIT 1
            ) AS PRODUCT_IMAGE_PATH,
            UNIT,
            QTY,
            COSTPRICE,
            SELLINGPRICE,
            EXPIRATION,
            USERID
               FROM ${templateTableName}
     WHERE ID = ?
       AND branch_id = ?
     LIMIT 1`,
    [branchId, result.insertId, branchId],
  );

  return rows[0] || null;
}

async function createStockBatchTemplateByBarcode(barcode, sessionUser, options = {}, branchId) {
  const templateTableName = await resolveTemplateTableName();
  const normalizedBarcode = normalizeText(barcode);
  const incrementQty = 1;
  const batchIdInput = options.batchId;

  if (!normalizedBarcode) {
    const error = new Error('Barcode is required.');
    error.statusCode = 400;
    throw error;
  }

  const product = await findStockBatchProductByBarcode(normalizedBarcode, branchId);

  if (!product) {
    const error = new Error('No matching product found for this barcode. Please add it to Products first.');
    error.statusCode = 404;
    throw error;
  }

  const batchId = await buildBatchId(batchIdInput, product.product_barcode, branchId);
  const userId = normalizeText(sessionUser?.userId);

  const [existingRows] = await getPool().query(
    `SELECT ID, QTY
     FROM ${templateTableName}
     WHERE BARCODE = ?
       AND branch_id = ?
     ORDER BY ID DESC
     LIMIT 1`,
    [product.product_barcode, branchId],
  );

  const existing = existingRows[0] || null;

  if (existing) {
    await getPool().query(
      `UPDATE ${templateTableName}
       SET QTY = COALESCE(QTY, 0) + ?,
           USERID = COALESCE(?, USERID)
       WHERE ID = ?
         AND branch_id = ?`,
      [incrementQty, userId, existing.ID, branchId],
    );

    const [updatedRows] = await getPool().query(
      `SELECT ID,
              BatchID,
              CATEGORY,
              BARCODE,
              DESCRIPTION,
              BRAND,
              (
                SELECT p.product_image_path
                FROM products p
                WHERE p.product_barcode = ${templateTableName}.BARCODE
                  AND p.branch_id = ?
                LIMIT 1
              ) AS PRODUCT_IMAGE_PATH,
              UNIT,
              QTY,
              COSTPRICE,
              SELLINGPRICE,
              EXPIRATION,
              USERID
       FROM ${templateTableName}
       WHERE ID = ?
         AND branch_id = ?
       LIMIT 1`,
      [branchId, existing.ID, branchId],
    );

    return {
      action: 'updated',
      data: updatedRows[0] || null,
    };
  }

  if (
    options.qty === undefined
    || options.costPrice === undefined
    || options.sellingPrice === undefined
  ) {
    return {
      action: 'requires_details',
      data: {
        barcode: product.product_barcode,
        description: normalizeText(product.product_name),
        category: normalizeText(product.category),
        brand: normalizeText(product.brand),
        unit: normalizeText(product.unit),
      },
    };
  }

  const qty = normalizeInteger(options.qty, 'Quantity');
  const costPrice = normalizeDecimal(options.costPrice, 'Cost price');
  const sellingPrice = normalizeDecimal(options.sellingPrice, 'Selling price');
  const expiration = normalizeExpiration(options.expiration);

  const [result] = await getPool().query(
    `INSERT INTO ${templateTableName}
      (BatchID, CATEGORY, BARCODE, DESCRIPTION, BRAND, UNIT, QTY, COSTPRICE, SELLINGPRICE, EXPIRATION, USERID, branch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batchId,
      normalizeText(product.category),
      product.product_barcode,
      normalizeText(product.product_name),
      normalizeText(product.brand),
      normalizeText(product.unit),
      qty,
      costPrice,
      sellingPrice,
      expiration,
      userId,
      branchId,
    ],
  );

  const [rows] = await getPool().query(
    `SELECT ID,
            BatchID,
            CATEGORY,
            BARCODE,
            DESCRIPTION,
            BRAND,
            (
              SELECT p.product_image_path
              FROM products p
              WHERE p.product_barcode = ${templateTableName}.BARCODE
                AND p.branch_id = ?
              LIMIT 1
            ) AS PRODUCT_IMAGE_PATH,
            UNIT,
            QTY,
            COSTPRICE,
            SELLINGPRICE,
            EXPIRATION,
            USERID
     FROM ${templateTableName}
     WHERE ID = ?
       AND branch_id = ?
     LIMIT 1`,
    [branchId, result.insertId, branchId],
  );

  return {
    action: 'inserted',
    data: rows[0] || null,
  };
}

async function listStockBatchTemplates(branchId, limit = 100) {
  const templateTableName = await resolveTemplateTableName();
  const normalizedLimit = Number(limit);
  const safeLimit = Number.isInteger(normalizedLimit)
    ? Math.min(Math.max(normalizedLimit, 1), 500)
    : 100;

  const [rows] = await getPool().query(
    `SELECT ID,
            BatchID,
            CATEGORY,
            BARCODE,
            DESCRIPTION,
            BRAND,
            (
              SELECT p.product_image_path
              FROM products p
              WHERE p.product_barcode = ${templateTableName}.BARCODE
                AND p.branch_id = ?
              LIMIT 1
            ) AS PRODUCT_IMAGE_PATH,
            UNIT,
            QTY,
            COSTPRICE,
            SELLINGPRICE,
            EXPIRATION,
            USERID
     FROM ${templateTableName}
     WHERE branch_id = ?
     ORDER BY ID DESC
     LIMIT ${safeLimit}`,
    [branchId, branchId],
  );

  return rows;
}

async function getStockBatchSyncPreview(branchId) {
  const templateTableName = await resolveTemplateTableName();

  const [rows] = await getPool().query(
    `SELECT t.BARCODE AS barcode,
            MAX(t.DESCRIPTION) AS description,
            SUM(COALESCE(t.QTY, 0)) AS add_qty,
            COALESCE((
              SELECT SUM(COALESCE(pb.Qty, 0))
              FROM product_batches pb
              WHERE pb.product_barcode = t.BARCODE
                AND pb.branch_id = ?
            ), 0) AS before_qty
     FROM ${templateTableName} t
     WHERE t.branch_id = ?
       AND t.BARCODE IS NOT NULL
       AND TRIM(t.BARCODE) <> ''
       AND COALESCE(t.QTY, 0) >= 1
     GROUP BY t.BARCODE
     ORDER BY MAX(t.DESCRIPTION) ASC, t.BARCODE ASC`,
    [branchId, branchId],
  );

  return rows.map((row) => {
    const beforeQty = Number(row.before_qty || 0);
    const addQty = Number(row.add_qty || 0);

    return {
      barcode: normalizeText(row.barcode),
      description: normalizeText(row.description),
      beforeQty,
      addQty,
      afterQty: beforeQty + addQty,
    };
  });
}

async function syncStockBatchTemplateToInventory(sessionUser = null, branchId) {
  const templateTableName = await resolveTemplateTableName();
  const connection = await getPool().getConnection();

  try {
    await ensureStockBatchSyncHistoryTable(connection);
    await connection.beginTransaction();

    const [templateRows] = await connection.query(
      `SELECT t.ID,
              t.BatchID,
              t.BARCODE,
              t.DESCRIPTION,
              t.QTY,
              t.COSTPRICE,
              t.SELLINGPRICE,
              t.EXPIRATION,
              t.USERID,
              COALESCE(p.rop, 0) AS rop
       FROM ${templateTableName} t
       LEFT JOIN products p ON p.product_barcode = t.BARCODE AND p.branch_id = t.branch_id
       WHERE t.branch_id = ?
         AND t.BARCODE IS NOT NULL
         AND TRIM(t.BARCODE) <> ''
         AND COALESCE(t.QTY, 0) >= 1
       ORDER BY t.ID ASC`,
      [branchId],
    );

    if (templateRows.length === 0) {
      await connection.commit();
      return {
        syncedRows: 0,
        syncedProducts: 0,
      };
    }

    const fallbackUserId = normalizeText(sessionUser?.userId);
    const syncUserId = normalizeText(sessionUser?.userId);
    const syncUsername = normalizeText(sessionUser?.username) || normalizeText(sessionUser?.fullName);
    const syncBatchId = randomUUID();
    const syncCode = await buildDailySyncCode(connection, branchId);
    const syncedIds = [];
    const syncedBarcodes = new Set();

    for (const row of templateRows) {
      const barcode = normalizeText(row.BARCODE);
      const qty = Number(row.QTY || 0);

      if (!barcode || qty < 1) {
        continue;
      }

      const userId = normalizeText(row.USERID) || fallbackUserId;

      const [qtyRows] = await connection.query(
        `SELECT COALESCE(SUM(COALESCE(pb.Qty, 0)), 0) AS before_qty
         FROM product_batches pb
         WHERE pb.product_barcode = ?
           AND pb.branch_id = ?`,
        [barcode, branchId],
      );

      const beforeQty = Number(qtyRows[0]?.before_qty || 0);
      const afterQty = beforeQty + qty;

      await connection.query(
        `INSERT INTO product_batches
          (batch_id, batch_date, product_barcode, Qty, cost_price, selling_price, quantity_remaining, reoder_point, ExpiryDate, UserID, Block, branch_id)
         VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          normalizeText(row.BatchID),
          barcode,
          qty,
          Number(row.COSTPRICE || 0),
          Number(row.SELLINGPRICE || 0),
          qty,
          Number(row.rop || 0),
          row.EXPIRATION || null,
          userId,
          branchId,
        ],
      );

      await connection.query(
        `INSERT INTO ${STOCK_BATCH_SYNC_HISTORY_TABLE}
          (sync_batch_id, sync_code, user_id, username, product_barcode, product_name, batch_id, qty_before, qty_added, qty_after, cost_price, selling_price, expiration_date, source, branch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'batch_sync', ?)`,
        [
          syncBatchId,
          syncCode,
          syncUserId,
          syncUsername,
          barcode,
          normalizeText(row.DESCRIPTION),
          normalizeText(row.BatchID),
          beforeQty,
          qty,
          afterQty,
          Number(row.COSTPRICE || 0),
          Number(row.SELLINGPRICE || 0),
          row.EXPIRATION || null,
          branchId,
        ],
      );

      syncedIds.push(Number(row.ID));
      syncedBarcodes.add(barcode);
    }

    if (syncedIds.length > 0) {
      const placeholders = syncedIds.map(() => '?').join(', ');
      await connection.query(
        `DELETE FROM ${templateTableName}
         WHERE ID IN (${placeholders})
           AND branch_id = ?`,
        [...syncedIds, branchId],
      );
    }

    await connection.commit();

    return {
      syncedRows: syncedIds.length,
      syncedProducts: syncedBarcodes.size,
      syncBatchId,
      syncCode,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listStockBatchSyncHistory({ branchId, startDate, endDate, search, productBarcode, limit } = {}) {
  const normalizedStartDate = normalizeDateFilter(startDate, 'start_date');
  const normalizedEndDate = normalizeDateFilter(endDate, 'end_date');

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    const error = new Error('start_date cannot be later than end_date.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedSearch = normalizeText(search);
  const normalizedProductBarcode = normalizeText(productBarcode);
  const numericLimit = Number(limit);
  const safeLimit = Number.isInteger(numericLimit)
    ? Math.min(Math.max(numericLimit, 1), 500)
    : 200;

  await ensureStockBatchSyncHistoryTable(getPool());

  const whereClauses = ['branch_id = ?'];
  const params = [branchId];

  if (normalizedStartDate) {
    whereClauses.push('DATE(sync_timestamp) >= ?');
    params.push(normalizedStartDate);
  }

  if (normalizedEndDate) {
    whereClauses.push('DATE(sync_timestamp) <= ?');
    params.push(normalizedEndDate);
  }

  if (normalizedProductBarcode) {
    whereClauses.push('product_barcode = ?');
    params.push(normalizedProductBarcode);
  }

  if (normalizedSearch) {
    whereClauses.push('(LOWER(COALESCE(product_barcode, \"\")) LIKE ? OR LOWER(COALESCE(product_name, \"\")) LIKE ? OR LOWER(COALESCE(username, \"\")) LIKE ? OR LOWER(COALESCE(sync_batch_id, \"\")) LIKE ? OR LOWER(COALESCE(sync_code, \"\")) LIKE ? OR LOWER(COALESCE(batch_id, \"\")) LIKE ?)');
    const likeValue = `%${normalizedSearch.toLowerCase()}%`;
    params.push(likeValue, likeValue, likeValue, likeValue, likeValue, likeValue);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await getPool().query(
    `SELECT id,
            sync_batch_id,
            sync_code,
            sync_timestamp,
            user_id,
            username,
            product_barcode,
            product_name,
            batch_id,
            qty_before,
            qty_added,
            qty_after,
            cost_price,
            selling_price,
            expiration_date,
            source
     FROM ${STOCK_BATCH_SYNC_HISTORY_TABLE}
     ${whereSql}
     ORDER BY sync_timestamp DESC, id DESC
     LIMIT ${safeLimit}`,
    params,
  );

  return {
    rows,
    filters: {
      start_date: normalizedStartDate,
      end_date: normalizedEndDate,
      search: normalizedSearch,
      product_barcode: normalizedProductBarcode,
      limit: safeLimit,
    },
  };
}

async function deleteStockBatchTemplateRowById(id, branchId) {
  const templateTableName = await resolveTemplateTableName();
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    const error = new Error('A valid stock batch template ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const [result] = await getPool().query(
    `DELETE FROM ${templateTableName}
     WHERE ID = ?
       AND branch_id = ?`,
    [numericId, branchId],
  );

  return result.affectedRows > 0;
}

async function updateStockBatchTemplateRowById(id, payload = {}, sessionUser = null, branchId) {
  const templateTableName = await resolveTemplateTableName();
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    const error = new Error('A valid stock batch template ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const qty = normalizeInteger(payload.qty, 'Quantity');
  const costPrice = normalizeDecimal(payload.costPrice, 'Cost price');
  const sellingPrice = normalizeDecimal(payload.sellingPrice, 'Selling price');
  const expiration = normalizeExpiration(payload.expiration);
  const userId = normalizeText(sessionUser?.userId);

  const [result] = await getPool().query(
    `UPDATE ${templateTableName}
     SET QTY = ?,
         COSTPRICE = ?,
         SELLINGPRICE = ?,
         EXPIRATION = ?,
         USERID = COALESCE(?, USERID)
     WHERE ID = ?
       AND branch_id = ?`,
    [qty, costPrice, sellingPrice, expiration, userId, numericId, branchId],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await getPool().query(
    `SELECT ID,
            BatchID,
            CATEGORY,
            BARCODE,
            DESCRIPTION,
            BRAND,
            (
              SELECT p.product_image_path
              FROM products p
              WHERE p.product_barcode = ${templateTableName}.BARCODE
                AND p.branch_id = ?
              LIMIT 1
            ) AS PRODUCT_IMAGE_PATH,
            UNIT,
            QTY,
            COSTPRICE,
            SELLINGPRICE,
            EXPIRATION,
            USERID
     FROM ${templateTableName}
     WHERE ID = ?
       AND branch_id = ?
     LIMIT 1`,
    [branchId, numericId, branchId],
  );

  return rows[0] || null;
}

module.exports = {
  listStockBatchProducts,
  createStockBatchTemplate,
  createStockBatchTemplateByBarcode,
  listStockBatchTemplates,
  getStockBatchSyncPreview,
  syncStockBatchTemplateToInventory,
  listStockBatchSyncHistory,
  deleteStockBatchTemplateRowById,
  updateStockBatchTemplateRowById,
};
