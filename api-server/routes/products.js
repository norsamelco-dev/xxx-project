const express = require('express');
const multer = require('multer');
const requireAuth = require('../middleware/requireAuth');
const requireBranchContext = require('../middleware/requireBranchContext');
const { findUserById, passwordsMatch } = require('../services/userService');
const {
  listProducts,
  listCategories,
  listBrands,
  listUnits,
  findProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../services/productService');

const router = express.Router();
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only png, jpg, jpeg, and webp files are allowed.');
      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

router.use(requireAuth);
router.use(requireBranchContext);

router.get('/', async (request, response) => {
  try {
    const branchId = request.branchId;
    const [data, categories, brands, units] = await Promise.all([
      listProducts(branchId),
      listCategories(branchId),
      listBrands(branchId),
      listUnits(branchId),
    ]);

    response.json({
      data,
      categories,
      brands,
      units,
    });
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
});

router.get('/barcode-exists', async (request, response) => {
  try {
    const barcode = String(request.query.barcode || '').trim();
    const excludeId = Number(request.query.excludeId);
    const normalizedExcludeId = Number.isInteger(excludeId) && excludeId > 0 ? excludeId : null;

    if (!barcode) {
      return response.status(400).json({
        error: 'Barcode is required.',
      });
    }

    const existingProduct = await findProductByBarcode(barcode, request.branchId, normalizedExcludeId);

    response.json({
      exists: Boolean(existingProduct),
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/', upload.single('product_image'), async (request, response) => {
  try {
    const data = await createProduct(request.branchId, request.body || {}, request.file || null);
    response.status(201).json({
      data,
      message: 'Product created successfully.',
    });
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(400).json({
        error: 'Product image file must be 4 MB or less.',
      });
      return;
    }

    const status = error.code === 'ER_DUP_ENTRY' ? 409 : error.statusCode || 500;
    response.status(status).json({
      error: error.code === 'ER_DUP_ENTRY' ? 'Duplicate value for a unique product field.' : error.message,
    });
  }
});

router.put('/:id', upload.single('product_image'), async (request, response) => {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        error: 'A valid product ID is required.',
      });
    }

    const data = await updateProduct(request.branchId, id, request.body || {}, request.file || null);

    if (!data) {
      return response.status(404).json({
        error: 'Product record not found.',
      });
    }

    response.json({
      data,
      message: 'Product updated successfully.',
    });
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(400).json({
        error: 'Product image file must be 4 MB or less.',
      });
      return;
    }

    const status = error.code === 'ER_DUP_ENTRY' ? 409 : error.statusCode || 500;
    response.status(status).json({
      error: error.code === 'ER_DUP_ENTRY' ? 'Duplicate value for a unique product field.' : error.message,
    });
  }
});

router.delete('/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const password = String(request.body?.password || '');
    const sessionUserId = request.session?.user?.userId;

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        error: 'A valid product ID is required.',
      });
    }

    if (!password) {
      return response.status(400).json({
        error: 'Password is required to delete a product record.',
      });
    }

    if (!sessionUserId) {
      return response.status(401).json({
        error: 'Unable to verify session user.',
      });
    }

    const user = await findUserById(sessionUserId);

    if (!user || !passwordsMatch(password, user.password_hash)) {
      return response.status(401).json({
        error: 'Password verification failed.',
      });
    }

    const deleted = await deleteProduct(request.branchId, id);

    if (!deleted) {
      return response.status(404).json({
        error: 'Product record not found.',
      });
    }

    response.json({
      message: 'Product deleted successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.use((error, _request, response, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(400).json({
      error: 'Product image file must be 4 MB or less.',
    });
    return;
  }

  if (error && error.statusCode) {
    response.status(error.statusCode).json({
      error: error.message,
    });
    return;
  }

  next(error);
});

module.exports = router;