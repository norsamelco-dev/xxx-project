const express = require('express');
const requirePosAuth = require('../middleware/requirePosAuth');
const {
  lookupTerminal,
  lookupProductByBarcode,
  searchProducts,
  listActiveSeries,
  createSalesSeries,
  setSalesSeriesStartingBalance,
  getSalesSeriesStartingBalance,
  closeSalesSeries,
  getSeriesCloseRequirements,
  markReportPrinted,
  getSummary,
  checkout,
  getXReport,
  runZReport,
  addToCartFifo,
  listCartLines,
  upsertCartLine,
  removeCartLine,
  clearCart,
  voidPosTransaction,
  voidPosTransactionItem,
  getPosTransactionReceipt,
} = require('../services/posService');
const {
  listSalesSeriesForPos,
  listPosSalesTransactionsBySeries,
  listPosSalesItemsByTransaction,
} = require('../services/salesService');

const router = express.Router();

router.get('/terminals/lookup', async (request, response) => {
  try {
    const data = await lookupTerminal(request.query.machine_name);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.use(requirePosAuth);

router.get('/products/lookup', async (request, response) => {
  try {
    const data = await lookupProductByBarcode(request.query.barcode);

    if (!data) {
      return response.status(404).json({ error: 'Product not found.' });
    }

    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/products/search', async (request, response) => {
  try {
    const data = await searchProducts(request.query.q);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/series/active', async (request, response) => {
  try {
    const data = await listActiveSeries(request.query.machine_name, request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/series', async (request, response) => {
  try {
    const data = await createSalesSeries(request.body.machine_name, request.posUser);
    return response.status(201).json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/series/:seriesNo/starting-balance', async (request, response) => {
  try {
    const data = await getSalesSeriesStartingBalance(request.params.seriesNo, request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/series/:seriesNo/starting-balance', async (request, response) => {
  try {
    const data = await setSalesSeriesStartingBalance(
      request.params.seriesNo,
      request.body.starting_balance,
      request.posUser,
    );
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/series/:seriesNo/close', async (request, response) => {
  try {
    const data = await closeSalesSeries(
      request.params.seriesNo,
      request.body.machine_name,
      request.posUser,
    );
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/series/:seriesNo/close-requirements', async (request, response) => {
  try {
    const data = await getSeriesCloseRequirements(
      request.params.seriesNo,
      request.query.machine_name,
      request.posUser,
    );
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message, details: error.details });
  }
});

router.post('/series/:seriesNo/reports/printed', async (request, response) => {
  try {
    const data = await markReportPrinted(
      request.params.seriesNo,
      request.body.machine_name,
      request.body.report_type,
      request.posUser,
    );
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message, details: error.details });
  }
});

router.get('/summary', async (request, response) => {
  try {
    const data = await getSummary(request.query.machine_name, request.query.series_no);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/checkout', async (request, response) => {
  try {
    const data = await checkout(request.body, request.posUser);
    return response.status(201).json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/cart/line', async (request, response) => {
  try {
    const data = await upsertCartLine(request.body, request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/cart/add', async (request, response) => {
  try {
    const data = await addToCartFifo(request.body, request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/cart', async (request, response) => {
  try {
    const data = await listCartLines(request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/cart/line/remove', async (request, response) => {
  try {
    const data = await removeCartLine(request.body, request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/cart/clear', async (request, response) => {
  try {
    const data = await clearCart(request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

async function resolvePosSalesAccess(request) {
  const terminal = await lookupTerminal(request.query.machine_name || request.body?.machine_name);

  return {
    machineName: terminal.terminal_name,
    userId: request.posUser.userId,
    minNumber: terminal.min_number,
  };
}

router.get('/sales/series', async (request, response) => {
  try {
    const access = await resolvePosSalesAccess(request);
    const data = await listSalesSeriesForPos(access);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/sales/series/:seriesNo/transactions', async (request, response) => {
  try {
    const access = await resolvePosSalesAccess(request);
    const seriesNo = String(request.params.seriesNo || '');
    const data = await listPosSalesTransactionsBySeries(seriesNo, access);

    return response.json({
      data,
      series_no: seriesNo,
    });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/sales/transactions/:orsi/items', async (request, response) => {
  try {
    const access = await resolvePosSalesAccess(request);
    const data = await listPosSalesItemsByTransaction(request.params.orsi, access);

    return response.json({
      data,
      orsi: Number(request.params.orsi),
    });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/sales/transactions/:orsi/void', async (request, response) => {
  try {
    const access = await resolvePosSalesAccess(request);
    const data = await voidPosTransaction(request.params.orsi, {
      voidReason: request.body?.void_reason,
      machineName: access.machineName,
      minNumber: access.minNumber,
      userId: access.userId,
    });

    return response.json({ data, message: 'Transaction cancelled.' });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/sales/transactions/:orsi/items/:itemId/void', async (request, response) => {
  try {
    const access = await resolvePosSalesAccess(request);
    const data = await voidPosTransactionItem(request.params.orsi, request.params.itemId, {
      voidReason: request.body?.void_reason,
      machineName: access.machineName,
      minNumber: access.minNumber,
      userId: access.userId,
    });

    return response.json({ data, message: 'Line item voided.' });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/sales/transactions/:orsi/receipt', async (request, response) => {
  try {
    const access = await resolvePosSalesAccess(request);
    const data = await getPosTransactionReceipt(request.params.orsi, access);

    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/reports/x', async (request, response) => {
  try {
    const data = await getXReport(request.query.machine_name, request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/reports/z', async (request, response) => {
  try {
    const data = await runZReport(request.body.machine_name, request.posUser);
    return response.json({ data });
  } catch (error) {
    return response.status(error.statusCode || 500).json({ error: error.message });
  }
});

module.exports = router;
