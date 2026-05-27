const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  getDashboardXData,
  getDashboardOverview,
  getDashboardSales,
  getDashboardInventory,
  getDashboardFinancial,
  getDashboardDamageReports,
} = require('../services/dashboardXService');

const router = express.Router();

router.use(requireAuth);

router.get('/overview', async (request, response) => {
  try {
    const data = await getDashboardOverview({
      startDate: request.query.start_date,
      endDate: request.query.end_date,
      groupBy: request.query.group_by,
    });

    response.json(data);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/sales', async (request, response) => {
  try {
    const data = await getDashboardSales({
      startDate: request.query.start_date,
      endDate: request.query.end_date,
      groupBy: request.query.group_by,
    });

    response.json(data);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/inventory', async (_request, response) => {
  try {
    const data = await getDashboardInventory();
    response.json(data);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/damage-reports', async (request, response) => {
  try {
    const data = await getDashboardDamageReports({
      startDate: request.query.start_date,
      endDate: request.query.end_date,
      groupBy: request.query.group_by,
    });

    response.json(data);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/financial', async (request, response) => {
  try {
    const data = await getDashboardFinancial({
      startDate: request.query.start_date,
      endDate: request.query.end_date,
    });

    response.json(data);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/', async (request, response) => {
  try {
    const data = await getDashboardXData({
      startDate: request.query.start_date,
      endDate: request.query.end_date,
      groupBy: request.query.group_by,
    });

    response.json(data);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

module.exports = router;
