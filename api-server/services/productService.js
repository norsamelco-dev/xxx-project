const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { getPool } = require('../db');

const PRODUCT_IMAGES_DIR = path.resolve(__dirname, '..', 'api', 'product-images');
const PRODUCT_IMAGES_PUBLIC_PREFIX = '/api/product-images/';

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

function normalizePayload(payload) {
  return {
    product_barcode: normalizeText(payload.product_barcode),
    product_name: normalizeText(payload.product_name),
    category: normalizeText(payload.category),
    brand: normalizeText(payload.brand),
    unit: normalizeText(payload.unit),
    rop: normalizeInteger(payload.rop, 'rop'),
  };
}

function toAbsoluteProductImagePath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') {
    return null;
  }

  if (!publicPath.startsWith(PRODUCT_IMAGES_PUBLIC_PREFIX)) {
    return null;
  }

  const fileName = path.basename(publicPath);
  if (!fileName) {
    return null;
  }

  return path.join(PRODUCT_IMAGES_DIR, fileName);
}

async function deleteProductImageIfExists(publicPath) {
  const absolutePath = toAbsoluteProductImagePath(publicPath);

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

async function saveProductImageAsWebp(file, productId) {
  if (!file) {
    return null;
  }

  await fs.mkdir(PRODUCT_IMAGES_DIR, { recursive: true });

  const fileName = `product-${productId}.webp`;
  const absolutePath = path.join(PRODUCT_IMAGES_DIR, fileName);

  await sharp(file.buffer)
    .rotate()
    .webp({ quality: 78, effort: 4 })
    .toFile(absolutePath);

  return `${PRODUCT_IMAGES_PUBLIC_PREFIX}${fileName}`;
}

function productSelectSql() {
  return `SELECT product_id,
            product_barcode,
            product_name,
            category,
            brand,
            product_image_path,
            (
              SELECT COALESCE(SUM(pb.Qty), 0)
              FROM product_batches pb
              WHERE pb.product_barcode = products.product_barcode
                AND pb.branch_id = products.branch_id
            ) AS qty,
            unit,
            rop,
            created_at,
            branch_id
     FROM products`;
}

async function listProducts(branchId) {
  const [rows] = await getPool().query(
    `${productSelectSql()}
     WHERE branch_id = ?
     ORDER BY product_id DESC`,
    [branchId],
  );

  return rows;
}

async function listCategories(branchId) {
  const [rows] = await getPool().query(
    `SELECT DISTINCT category
     FROM products
     WHERE branch_id = ?
       AND category IS NOT NULL
       AND TRIM(category) <> ''
     ORDER BY category ASC`,
    [branchId],
  );

  return rows.map((row) => row.category);
}

async function listBrands(branchId) {
  const [rows] = await getPool().query(
    `SELECT DISTINCT brand
     FROM products
     WHERE branch_id = ?
       AND brand IS NOT NULL
       AND TRIM(brand) <> ''
     ORDER BY brand ASC`,
    [branchId],
  );

  return rows.map((row) => row.brand);
}

async function listUnits(branchId) {
  const [rows] = await getPool().query(
    `SELECT DISTINCT unit
     FROM products
     WHERE branch_id = ?
       AND unit IS NOT NULL
       AND TRIM(unit) <> ''
     ORDER BY unit ASC`,
    [branchId],
  );

  return rows.map((row) => row.unit);
}

async function findProductByBarcode(productBarcode, branchId, excludeProductId = null) {
  const normalizedBarcode = normalizeText(productBarcode);

  if (!normalizedBarcode) {
    return null;
  }

  const queryParts = [
    `SELECT product_id, product_barcode
     FROM products
     WHERE product_barcode = ?
       AND branch_id = ?`,
  ];

  const params = [normalizedBarcode, branchId];

  if (excludeProductId !== null && excludeProductId !== undefined) {
    queryParts.push('AND product_id <> ?');
    params.push(excludeProductId);
  }

  queryParts.push('LIMIT 1');

  const [rows] = await getPool().query(queryParts.join('\n'), params);
  return rows[0] || null;
}

async function createProduct(branchId, payload, productImageFile = null) {
  const normalized = normalizePayload(payload || {});
  const pool = getPool();
  const connection = await pool.getConnection();
  let createdImagePath = null;

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO products
        (product_barcode, product_name, category, brand, unit, rop, product_image_path, created_at, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NOW(), ?)`,
      [
        normalized.product_barcode,
        normalized.product_name,
        normalized.category,
        normalized.brand,
        normalized.unit,
        normalized.rop,
        branchId,
      ],
    );

    if (productImageFile) {
      createdImagePath = await saveProductImageAsWebp(productImageFile, result.insertId);

      await connection.query(
        `UPDATE products
         SET product_image_path = ?
         WHERE product_id = ?
           AND branch_id = ?`,
        [createdImagePath, result.insertId, branchId],
      );
    }

    const [rows] = await connection.query(
      `${productSelectSql()}
       WHERE product_id = ?
         AND branch_id = ?`,
      [result.insertId, branchId],
    );

    await connection.commit();
    return rows[0] || null;
  } catch (error) {
    await connection.rollback();

    if (createdImagePath) {
      await deleteProductImageIfExists(createdImagePath);
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function updateProduct(branchId, id, payload, productImageFile = null) {
  const normalized = normalizePayload(payload || {});
  const pool = getPool();
  const connection = await pool.getConnection();
  let nextImagePath = null;
  let previousImagePath = null;

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `SELECT product_id, product_image_path
       FROM products
       WHERE product_id = ?
         AND branch_id = ?
       LIMIT 1`,
      [id, branchId],
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return null;
    }

    previousImagePath = existingRows[0].product_image_path || null;
    nextImagePath = previousImagePath;

    if (productImageFile) {
      nextImagePath = await saveProductImageAsWebp(productImageFile, id);
    }

    const [result] = await connection.query(
      `UPDATE products
       SET product_barcode = ?,
           product_name = ?,
           category = ?,
           brand = ?,
           unit = ?,
           rop = ?,
           product_image_path = ?
       WHERE product_id = ?
         AND branch_id = ?`,
      [
        normalized.product_barcode,
        normalized.product_name,
        normalized.category,
        normalized.brand,
        normalized.unit,
        normalized.rop,
        nextImagePath,
        id,
        branchId,
      ],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();

      if (productImageFile && nextImagePath && nextImagePath !== previousImagePath) {
        await deleteProductImageIfExists(nextImagePath);
      }

      return null;
    }

    const [rows] = await connection.query(
      `${productSelectSql()}
       WHERE product_id = ?
         AND branch_id = ?`,
      [id, branchId],
    );

    await connection.commit();

    if (productImageFile && previousImagePath && previousImagePath !== nextImagePath) {
      await deleteProductImageIfExists(previousImagePath);
    }

    return rows[0] || null;
  } catch (error) {
    await connection.rollback();

    if (productImageFile && nextImagePath && nextImagePath !== previousImagePath) {
      await deleteProductImageIfExists(nextImagePath);
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function deleteProduct(branchId, id) {
  const pool = getPool();
  const connection = await pool.getConnection();
  let productImagePath = null;

  try {
    await connection.beginTransaction();

    const [productRows] = await connection.query(
      `SELECT product_id, product_barcode, product_image_path
       FROM products
       WHERE product_id = ?
         AND branch_id = ?
       LIMIT 1`,
      [id, branchId],
    );

    if (productRows.length === 0) {
      await connection.rollback();
      return false;
    }

    const productBarcode = productRows[0].product_barcode;
    productImagePath = productRows[0].product_image_path || null;

    if (productBarcode) {
      await connection.query(
        'DELETE FROM product_batches WHERE product_barcode = ? AND branch_id = ?',
        [productBarcode, branchId],
      );
    }

    const [result] = await connection.query(
      'DELETE FROM products WHERE product_id = ? AND branch_id = ?',
      [id, branchId],
    );
    await connection.commit();

    if (result.affectedRows > 0 && productImagePath) {
      await deleteProductImageIfExists(productImagePath);
    }

    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listProducts,
  listCategories,
  listBrands,
  listUnits,
  findProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
};
