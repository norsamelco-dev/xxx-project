const { logAuditAction } = require('../controllers/auditController');

function auditLogger(request, response, next) {
  response.on('finish', () => {
    if (!request.originalUrl.startsWith('/api')) {
      return;
    }

    void logAuditAction(request, response).catch((error) => {
      console.error('Audit log insert failed:', error.message);
    });
  });

  next();
}

module.exports = auditLogger;