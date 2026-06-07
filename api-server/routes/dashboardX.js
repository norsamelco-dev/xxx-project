const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireBranchContext = require('../middleware/requireBranchContext');
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
router.use(requireBranchContext);

router.get('/overview', async (request, response) => {
  try {
    const data = await getDashboardOverview({
      branchId: request.branchId,
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
      branchId: request.branchId,
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

router.get('/inventory', async (request, response) => {
  try {
    const data = await getDashboardInventory(request.branchId);
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
      branchId: request.branchId,
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
      branchId: request.branchId,
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
      branchId: request.branchId,
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
