const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireBranchContext = require('../middleware/requireBranchContext');
const { findUserById, passwordsMatch } = require('../services/userService');
const {
  listStockBatchProducts,
  createStockBatchTemplate,
  createStockBatchTemplateByBarcode,
  listStockBatchTemplates,
  getStockBatchSyncPreview,
  syncStockBatchTemplateToInventory,
  listStockBatchSyncHistory,
  deleteStockBatchTemplateRowById,
  updateStockBatchTemplateRowById,
} = require('../services/stockBatchService');

const router = express.Router();

router.use(requireAuth);
router.use(requireBranchContext);

router.get('/products', async (request, response) => {
  try {
    const data = await listStockBatchProducts(request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
});

router.get('/templates', async (request, response) => {
  try {
    const limit = Number(request.query.limit);
    const data = await listStockBatchTemplates(request.branchId, limit);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/templates', async (request, response) => {
  try {
    const data = await createStockBatchTemplate(
      request.body || {},
      request.session?.user || null,
      request.branchId,
    );

    response.status(201).json({
      data,
      message: 'Stock batch template saved successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/templates/by-barcode', async (request, response) => {
  try {
    const barcode = String(request.body?.barcode || '');
    const result = await createStockBatchTemplateByBarcode(
      barcode,
      request.session?.user || null,
      {
        batchId: request.body?.batchId ?? null,
        qty: request.body?.qty,
        costPrice: request.body?.costPrice,
        sellingPrice: request.body?.sellingPrice,
        expiration: request.body?.expiration,
      },
      request.branchId,
    );
    const isUpdated = result?.action === 'updated';
    const needsDetails = result?.action === 'requires_details';

    if (needsDetails) {
      return response.status(409).json({
        code: 'DETAILS_REQUIRED',
        data: result?.data || null,
        message: 'Additional stock batch details are required for new template rows.',
      });
    }

    response.status(isUpdated ? 200 : 201).json({
      data: result?.data || null,
      message: isUpdated
        ? 'Barcode already exists in template. Quantity has been increased.'
        : 'Stock batch template row created from barcode match.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.delete('/templates/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const deleted = await deleteStockBatchTemplateRowById(id, request.branchId);

    if (!deleted) {
      return response.status(404).json({
        error: 'Stock batch template row not found.',
      });
    }

    response.json({
      message: 'Stock batch template row deleted successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.put('/templates/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const data = await updateStockBatchTemplateRowById(
      id,
      request.body || {},
      request.session?.user || null,
      request.branchId,
    );

    if (!data) {
      return response.status(404).json({
        error: 'Stock batch template row not found.',
      });
    }

    response.json({
      data,
      message: 'Stock batch template row updated successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/sync-preview', async (request, response) => {
  try {
    const data = await getStockBatchSyncPreview(request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/sync', async (request, response) => {
  try {
    const password = String(request.body?.password || '');
    const sessionUserId = request.session?.user?.userId;

    if (!password) {
      return response.status(400).json({
        error: 'Password is required to confirm sync.',
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

    const data = await syncStockBatchTemplateToInventory(
      request.session?.user || null,
      request.branchId,
    );

    response.json({
      data,
      message: data.syncedRows > 0
        ? `Synced ${data.syncedRows} row(s) across ${data.syncedProducts} product(s) to inventory.`
        : 'No eligible stock batch template rows to sync.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/sync-history', async (request, response) => {
  try {
    const result = await listStockBatchSyncHistory({
      branchId: request.branchId,
      startDate: request.query.start_date,
      endDate: request.query.end_date,
      search: request.query.search,
      productBarcode: request.query.product_barcode,
      limit: request.query.limit,
    });

    response.json({
      data: result.rows,
      filters: result.filters,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

module.exports = router;
