const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  listSalesSeries,
  listSalesTransactionsBySeries,
  listSalesItemsByTransaction,
} = require('../services/salesService');

const router = express.Router();

router.use(requireAuth);

router.get('/series', async (request, response) => {
  try {
    const result = await listSalesSeries({
      startDate: request.query.start_date,
      endDate: request.query.end_date,
      search: request.query.search,
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

router.get('/series/:seriesNo/transactions', async (request, response) => {
  try {
    const seriesNo = String(request.params.seriesNo || '');
    const data = await listSalesTransactionsBySeries(seriesNo);

    response.json({
      data,
      series_no: seriesNo,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/transactions/:orsi/items', async (request, response) => {
  try {
    const data = await listSalesItemsByTransaction(request.params.orsi);

    response.json({
      data,
      orsi: Number(request.params.orsi),
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

module.exports = router;
