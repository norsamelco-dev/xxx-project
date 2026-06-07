const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireBranchContext = require('../middleware/requireBranchContext');
const {
  listReorderAlerts,
  listSuppliers,
  createSupplier,
  updateSupplier,
  listRequisitions,
  getRequisition,
  createRequisition,
  updateRequisition,
  deleteRequisition,
  submitRequisition,
  approveRequisition,
  rejectRequisition,
  resubmitRequisition,
  listOrders,
  getOrder,
  createOrderFromPr,
  updateOrder,
  sendOrder,
  cancelOrder,
  listReceivingReports,
  getReceivingReport,
  createReceivingReport,
  updateReceivingReport,
  confirmReceivingReport,
  createInvoice,
  getInvoice,
  updateInvoice,
  runThreeWayMatch,
  approveThreeWayMatch,
  listPayables,
  createPayableFromPo,
  recordPayment,
  getPayablesAging,
  getRequisitionReport,
  getOrderReport,
  getReceivingReportList,
  getMatchingReport,
  getProcurementAuditTrail,
} = require('../services/procurementService');

const router = express.Router();

router.use(requireAuth);
router.use(requireBranchContext);

router.get('/reorder-alerts', async (request, response) => {
  try {
    const data = await listReorderAlerts(request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/suppliers', async (request, response) => {
  try {
    const data = await listSuppliers({
      branchId: request.branchId,
      activeOnly: request.query.active_only !== '0',
      search: request.query.search,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/suppliers', async (request, response) => {
  try {
    const data = await createSupplier(request.body || {}, request.branchId);
    response.status(201).json({ data, message: 'Supplier created successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.put('/suppliers/:id', async (request, response) => {
  try {
    const data = await updateSupplier(Number(request.params.id), request.body || {}, request.branchId);
    response.json({ data, message: 'Supplier updated successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/requisitions/report', async (request, response) => {
  try {
    const data = await getRequisitionReport({
      branchId: request.branchId,
      status: request.query.status,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
      createdBy: request.query.created_by,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/requisitions', async (request, response) => {
  try {
    const data = await listRequisitions({
      branchId: request.branchId,
      status: request.query.status,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
      search: request.query.search,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/requisitions/:id', async (request, response) => {
  try {
    const data = await getRequisition(Number(request.params.id), request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/requisitions', async (request, response) => {
  try {
    const data = await createRequisition(request.body || {}, request.session.user, request.branchId);
    response.status(201).json({ data, message: 'Purchase requisition created successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.put('/requisitions/:id', async (request, response) => {
  try {
    const data = await updateRequisition(Number(request.params.id), request.body || {}, request.branchId);
    response.json({ data, message: 'Purchase requisition updated successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.delete('/requisitions/:id', async (request, response) => {
  try {
    await deleteRequisition(Number(request.params.id), request.branchId);
    response.json({ message: 'Purchase requisition deleted successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/requisitions/:id/submit', async (request, response) => {
  try {
    const data = await submitRequisition(Number(request.params.id), request.branchId);
    response.json({ data, message: 'Purchase requisition submitted successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/requisitions/:id/approve', async (request, response) => {
  try {
    const data = await approveRequisition(Number(request.params.id), request.session.user, request.branchId);
    response.json({ data, message: 'Purchase requisition approved successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/requisitions/:id/reject', async (request, response) => {
  try {
    const data = await rejectRequisition(
      Number(request.params.id),
      request.body || {},
      request.session.user,
      request.branchId,
    );
    response.json({ data, message: 'Purchase requisition rejected.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/requisitions/:id/resubmit', async (request, response) => {
  try {
    const data = await resubmitRequisition(Number(request.params.id), request.branchId);
    response.json({ data, message: 'Purchase requisition moved back to draft.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/orders/report', async (request, response) => {
  try {
    const data = await getOrderReport({
      branchId: request.branchId,
      status: request.query.status,
      supplierId: request.query.supplier_id,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/orders', async (request, response) => {
  try {
    const data = await listOrders({
      branchId: request.branchId,
      status: request.query.status,
      supplierId: request.query.supplier_id,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
      search: request.query.search,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/orders/:id', async (request, response) => {
  try {
    const data = await getOrder(Number(request.params.id), request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/orders', async (request, response) => {
  try {
    const prId = Number(request.body?.purchase_requisition_id || request.body?.pr_id);
    const data = await createOrderFromPr(prId, request.body || {}, request.session.user, request.branchId);
    response.status(201).json({ data, message: 'Purchase order created successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.put('/orders/:id', async (request, response) => {
  try {
    const data = await updateOrder(Number(request.params.id), request.body || {}, request.branchId);
    response.json({ data, message: 'Purchase order updated successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/orders/:id/send', async (request, response) => {
  try {
    const data = await sendOrder(Number(request.params.id), request.session.user, request.branchId);
    response.json({ data, message: 'Purchase order sent to supplier.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/orders/:id/cancel', async (request, response) => {
  try {
    const data = await cancelOrder(
      Number(request.params.id),
      request.body || {},
      request.session.user,
      request.branchId,
    );
    response.json({ data, message: 'Purchase order cancelled.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/orders/:id/match', async (request, response) => {
  try {
    const data = await runThreeWayMatch(Number(request.params.id), request.branchId);
    response.json({ data, message: 'Three-way match completed.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/orders/:id/match/approve', async (request, response) => {
  try {
    const data = await approveThreeWayMatch(Number(request.params.id), request.session.user, request.branchId);
    response.json({ data, message: 'Three-way match approved for payment.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/receiving-reports/report', async (request, response) => {
  try {
    const data = await getReceivingReportList({
      branchId: request.branchId,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
      supplierId: request.query.supplier_id,
      poNumber: request.query.po_number,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/receiving-reports', async (request, response) => {
  try {
    const data = await listReceivingReports({
      branchId: request.branchId,
      status: request.query.status,
      purchaseOrderId: request.query.purchase_order_id,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/receiving-reports/:id', async (request, response) => {
  try {
    const data = await getReceivingReport(Number(request.params.id), request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/receiving-reports', async (request, response) => {
  try {
    const poId = Number(request.body?.purchase_order_id || request.body?.po_id);
    const data = await createReceivingReport(poId, request.body || {}, request.session.user, request.branchId);
    response.status(201).json({ data, message: 'Receiving report created successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.put('/receiving-reports/:id', async (request, response) => {
  try {
    const data = await updateReceivingReport(Number(request.params.id), request.body || {}, request.branchId);
    response.json({ data, message: 'Receiving report updated successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/receiving-reports/:id/confirm', async (request, response) => {
  try {
    const data = await confirmReceivingReport(Number(request.params.id), request.session.user, request.branchId);
    response.json({ data, message: 'Receiving report confirmed and inventory updated.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/invoices', async (request, response) => {
  try {
    const data = await createInvoice(request.body || {}, request.session.user, request.branchId);
    response.status(201).json({ data, message: 'Supplier invoice created successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/invoices/:id', async (request, response) => {
  try {
    const data = await getInvoice(Number(request.params.id), request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.put('/invoices/:id', async (request, response) => {
  try {
    const data = await updateInvoice(Number(request.params.id), request.body || {}, request.branchId);
    response.json({ data, message: 'Supplier invoice updated successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/payables/aging', async (request, response) => {
  try {
    const data = await getPayablesAging(request.branchId);
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/payables', async (request, response) => {
  try {
    const data = await listPayables({ branchId: request.branchId, status: request.query.status });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/payables', async (request, response) => {
  try {
    const poId = Number(request.body?.purchase_order_id || request.body?.po_id);
    const data = await createPayableFromPo(poId, request.branchId);
    response.status(201).json({ data, message: 'Accounts payable record created.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/payables/:id/pay', async (request, response) => {
  try {
    const data = await recordPayment(
      Number(request.params.id),
      request.body || {},
      request.session.user,
      request.branchId,
    );
    response.json({ data, message: 'Payment recorded successfully.' });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/matching/report', async (request, response) => {
  try {
    const data = await getMatchingReport({
      branchId: request.branchId,
      status: request.query.status,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/audit-trail', async (request, response) => {
  try {
    const data = await getProcurementAuditTrail({
      branchId: request.branchId,
      dateFrom: request.query.date_from,
      dateTo: request.query.date_to,
    });
    response.json({ data });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
});

module.exports = router;
