const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { recordClientAudit } = require('../controllers/auditController');
const { listAuditLogs, listAuditLogUsers } = require('../services/auditLogsService');

const router = express.Router();

router.post('/record', async (request, response) => {
  try {
    await recordClientAudit(request);

    response.json({
      message: 'Audit event recorded.',
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.use(requireAuth);

router.get('/users', async (_request, response) => {
  try {
    const users = await listAuditLogUsers();

    response.json({
      data: users,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

router.get('/', async (request, response) => {
  try {
    const { start_date: startDate, end_date: endDate, username } = request.query;
    const result = await listAuditLogs({ startDate, endDate, username });

    response.json({
      data: result.rows,
      filters: {
        start_date: result.range.startDate,
        end_date: result.range.endDate,
        username: result.username,
      },
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

module.exports = router;
