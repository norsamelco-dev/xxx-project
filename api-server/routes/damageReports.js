const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { findUserById, passwordsMatch } = require('../services/userService');
const {
  listDamageReasonOptions,
  listAllDamageReasonOptions,
  createDamageReasonOption,
  updateDamageReasonOption,
  deleteDamageReasonOption,
  reorderDamageReasonOptions,
  listDamageReports,
  getDamageReport,
  createDamageReport,
  updateDamageReport,
  deleteDamageReport,
  addDamageReportItem,
  updateDamageReportItem,
  deleteDamageReportItem,
  listDamageReportProducts,
  lookupDamageReportProductByBarcode,
  searchDamageReportProducts,
  getDamageReportSyncPreview,
  syncDamageReport,
  listDamageReportSyncLogs,
  listSyncLogsForReport,
} = require('../services/damageReportService');

const router = express.Router();

router.use(requireAuth);

router.get('/reasons', async (_request, response) => {
  try {
    const data = await listDamageReasonOptions();
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/reason-options', async (_request, response) => {
  try {
    const data = await listAllDamageReasonOptions();
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/reason-options', async (request, response) => {
  try {
    const data = await createDamageReasonOption(request.body || {});

    response.status(201).json({
      data,
      message: 'Damage reason option created successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.put('/reason-options/reorder', async (request, response) => {
  try {
    const data = await reorderDamageReasonOptions(request.body?.ordered_ids);

    response.json({
      data,
      message: 'Damage reason options reordered successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.put('/reason-options/:optionId', async (request, response) => {
  try {
    const optionId = Number(request.params.optionId);
    const data = await updateDamageReasonOption(optionId, request.body || {});

    response.json({
      data,
      message: 'Damage reason option updated successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.delete('/reason-options/:optionId', async (request, response) => {
  try {
    const optionId = Number(request.params.optionId);
    await deleteDamageReasonOption(optionId);

    response.json({
      message: 'Damage reason option deleted successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/products/lookup', async (request, response) => {
  try {
    const data = await lookupDamageReportProductByBarcode(request.query.barcode);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/products', async (_request, response) => {
  try {
    const data = await listDamageReportProducts();
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/products/search', async (request, response) => {
  try {
    const data = await searchDamageReportProducts(request.query.q);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/sync-logs', async (request, response) => {
  try {
    const payload = await listDamageReportSyncLogs({
      startDate: request.query.start_date,
      endDate: request.query.end_date,
      username: request.query.username,
      reportNumber: request.query.report_number,
      search: request.query.search,
      limit: request.query.limit,
    });

    response.json(payload);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/', async (request, response) => {
  try {
    const data = await listDamageReports({
      status: request.query.status,
      search: request.query.search,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
    });

    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/', async (request, response) => {
  try {
    const data = await createDamageReport(request.session?.user || null);

    response.status(201).json({
      data,
      message: `Damage report ${data.report_number} created successfully.`,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/:id/sync-preview', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const data = await getDamageReportSyncPreview(id);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/:id/sync-logs', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const payload = await listSyncLogsForReport(id);
    response.json(payload);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/:id/sync', async (request, response) => {
  try {
    const id = Number(request.params.id);
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

    const data = await syncDamageReport(id, request.session?.user || null);

    response.json({
      data,
      message: `Damage report ${data.report_number} synced successfully.`,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
      details: error.details || null,
    });
  }
});

router.get('/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const data = await getDamageReport(id);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.put('/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const data = await updateDamageReport(id, request.body || {});

    response.json({
      data,
      message: 'Damage report updated successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.delete('/:id', async (request, response) => {
  try {
    const id = Number(request.params.id);
    await deleteDamageReport(id);

    response.json({
      message: 'Damage report deleted successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.post('/:id/items', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const data = await addDamageReportItem(id, request.body || {});

    response.status(201).json({
      data,
      message: 'Damage report item added successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.put('/:id/items/:itemId', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const itemId = Number(request.params.itemId);
    const data = await updateDamageReportItem(id, itemId, request.body || {});

    response.json({
      data,
      message: 'Damage report item updated successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.delete('/:id/items/:itemId', async (request, response) => {
  try {
    const id = Number(request.params.id);
    const itemId = Number(request.params.itemId);
    await deleteDamageReportItem(id, itemId);

    response.json({
      message: 'Damage report item removed successfully.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

module.exports = router;
