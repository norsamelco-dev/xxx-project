import { apiFetch, type ApiFetchInit } from './api'
import type { AuditMeta } from './audit'

const BASE = '/api/procurement'

export type ProcurementListResponse<T> = { data: T[] }
export type ProcurementItemResponse<T> = { data: T; message?: string }
export type ProcurementMessageResponse = { message: string }

export type ReorderAlert = {
  product_name: string
  sku: string
  barcode: string
  current_stock: number
  rop: number
  suggested_order_qty: number
}

export type Supplier = {
  id: number
  supplier_name: string
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  payment_terms: string | null
  address: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export type PurchaseRequisition = {
  id: number
  pr_number: string
  status: string
  preferred_supplier_id: number | null
  preferred_supplier_name: string | null
  remarks: string | null
  rejection_reason: string | null
  created_by_user_id: number | null
  created_by_username: string | null
  submitted_at: string | null
  approved_by_user_id: number | null
  approved_by_username: string | null
  approved_at: string | null
  rejected_by_user_id: number | null
  rejected_by_username: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
  item_count: number
  items?: PurchaseRequisitionItem[]
}

export type PurchaseRequisitionItem = {
  id?: number
  purchase_requisition_id?: number
  product_id?: number | null
  product_name: string
  sku: string
  product_barcode: string
  qty_requested: number
  unit_snapshot?: string | null
  sort_order?: number
  lookup?: string
}

export type PurchaseOrder = {
  id: number
  po_number: string
  purchase_requisition_id: number
  pr_number: string | null
  supplier_id: number
  supplier_name: string | null
  status: string
  expected_delivery_date: string | null
  cancel_reason: string | null
  created_by_user_id: number | null
  created_by_username: string | null
  sent_by_user_id: number | null
  sent_by_username: string | null
  sent_at: string | null
  cancelled_by_user_id: number | null
  cancelled_by_username: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  item_count: number
  items?: PurchaseOrderItem[]
}

export type PurchaseOrderItem = {
  id: number
  purchase_order_id?: number
  purchase_requisition_item_id?: number | null
  product_id?: number | null
  product_name: string
  sku: string
  product_barcode: string
  qty_ordered: number
  qty_received: number
  unit_cost: number
  sort_order?: number
}

export type ReceivingReport = {
  id: number
  rr_number: string
  purchase_order_id: number
  po_number: string | null
  supplier_dr_number: string | null
  status: string
  remarks: string | null
  created_by_user_id: number | null
  created_by_username: string | null
  received_by_user_id: number | null
  received_by_username: string | null
  received_at: string | null
  created_at: string
  updated_at: string
  item_count: number
  items?: ReceivingReportItem[]
}

export type ReceivingReportItem = {
  id?: number
  receiving_report_id?: number
  purchase_order_item_id: number
  product_name: string
  sku: string
  product_barcode: string
  qty_received: number
  item_condition: string
  expiry_date: string | null
  batch_number: string | null
  unit_cost_snapshot?: number
  sort_order?: number
}

export type SupplierInvoice = {
  id: number
  purchase_order_id: number
  po_number: string | null
  invoice_number: string
  status: string
  invoice_date: string | null
  amount_total: number
  payment_terms: string | null
  created_by_user_id: number | null
  created_by_username: string | null
  created_at: string
  updated_at: string
  items?: SupplierInvoiceItem[]
}

export type SupplierInvoiceItem = {
  id?: number
  supplier_invoice_id?: number
  purchase_order_item_id: number
  product_name: string
  sku: string
  product_barcode: string
  qty_invoiced: number
  unit_price: number
  line_total: number
  sort_order?: number
}

export type ThreeWayMatch = {
  id: number
  purchase_order_id: number
  po_number?: string | null
  status: string
  discrepancy: {
    discrepancies?: Array<{
      purchase_order_item_id: number
      product_barcode: string
      product_name: string
      qty_ordered: number
      qty_received_good: number
      qty_invoiced: number
      po_amount: number
      received_amount: number
      invoice_amount: number
    }>
    totals?: { po_total: number; received_total: number; invoice_total: number }
  } | null
  reviewed_by_username?: string | null
  reviewed_at?: string | null
  created_at?: string
  updated_at?: string
}

export type Payable = {
  id: number
  purchase_order_id: number
  po_number: string | null
  supplier_invoice_id: number | null
  supplier_id: number
  supplier_name: string | null
  status: string
  amount_due: number
  amount_paid: number
  balance: number
  payment_terms: string | null
  payment_date: string | null
  payment_method: string | null
  paid_by_user_id: number | null
  paid_by_username: string | null
  created_at: string
  updated_at: string
  days_outstanding?: number
}

export type PayablesAging = {
  buckets: {
    current: Payable[]
    days_1_30: Payable[]
    days_31_60: Payable[]
    days_61_90: Payable[]
    days_90_plus: Payable[]
  }
  summary: {
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    days_90_plus: number
    total_outstanding: number
  }
}

export type RequisitionReport = {
  summary: Array<{ status: string; count: number }>
  details: Array<{
    id: number
    pr_number: string
    status: string
    created_by_username: string | null
    created_at: string
    product_name: string | null
    product_barcode: string | null
    qty_requested: number | null
  }>
}

export type OrderReport = {
  summary: Array<{ status: string; count: number; total_value: number }>
  details: Array<{
    id: number
    po_number: string
    status: string
    supplier_name: string | null
    created_at: string
    product_name: string | null
    product_barcode: string | null
    qty_ordered: number | null
    qty_received: number | null
    unit_cost: number | null
  }>
}

export type MatchingReportRow = ThreeWayMatch

export type ProcurementAuditTrail = {
  match_reviews: ThreeWayMatch[]
}

export type ListReorderAlertsParams = Record<string, never>
export type ListSuppliersParams = { active_only?: string; search?: string }
export type ListRequisitionsParams = { status?: string; date_from?: string; date_to?: string; search?: string }
export type ListOrdersParams = { status?: string; supplier_id?: string; date_from?: string; date_to?: string; search?: string }
export type ListReceivingParams = { status?: string; purchase_order_id?: string; date_from?: string; date_to?: string }
export type ListPayablesParams = { status?: string }
export type ReportParams = { status?: string; date_from?: string; date_to?: string; supplier_id?: string; po_number?: string }

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, value)
    }
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

function withAudit(init: ApiFetchInit = {}, audit?: AuditMeta): ApiFetchInit {
  return audit ? { ...init, audit } : init
}

export async function fetchReorderAlerts() {
  return apiFetch<ProcurementListResponse<ReorderAlert>>(`${BASE}/reorder-alerts`)
}

export async function fetchSuppliers(params: ListSuppliersParams = {}) {
  const query = buildQuery({
    active_only: params.active_only,
    search: params.search,
  })
  return apiFetch<ProcurementListResponse<Supplier>>(`${BASE}/suppliers${query}`)
}

export async function createSupplier(payload: Partial<Supplier>, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<Supplier>>(`${BASE}/suppliers`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function updateSupplier(id: number, payload: Partial<Supplier>, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<Supplier>>(`${BASE}/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function fetchRequisitions(params: ListRequisitionsParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<ProcurementListResponse<PurchaseRequisition>>(`${BASE}/requisitions${query}`)
}

export async function fetchRequisition(id: number) {
  return apiFetch<ProcurementItemResponse<PurchaseRequisition>>(`${BASE}/requisitions/${id}`)
}

export async function createRequisition(
  payload: { preferred_supplier_id?: number | null; remarks?: string; items: PurchaseRequisitionItem[] },
  audit?: AuditMeta,
) {
  return apiFetch<ProcurementItemResponse<PurchaseRequisition>>(`${BASE}/requisitions`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function updateRequisition(
  id: number,
  payload: { preferred_supplier_id?: number | null; remarks?: string; items?: PurchaseRequisitionItem[] },
  audit?: AuditMeta,
) {
  return apiFetch<ProcurementItemResponse<PurchaseRequisition>>(`${BASE}/requisitions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function deleteRequisition(id: number, audit?: AuditMeta) {
  return apiFetch<ProcurementMessageResponse>(`${BASE}/requisitions/${id}`, {
    method: 'DELETE',
    ...withAudit({}, audit),
  })
}

export async function submitRequisition(id: number, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<PurchaseRequisition>>(`${BASE}/requisitions/${id}/submit`, {
    method: 'POST',
    ...withAudit({}, audit),
  })
}

export async function approveRequisition(id: number, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<PurchaseRequisition>>(`${BASE}/requisitions/${id}/approve`, {
    method: 'POST',
    ...withAudit({}, audit),
  })
}

export async function rejectRequisition(id: number, reason: string, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<PurchaseRequisition>>(`${BASE}/requisitions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    ...withAudit({}, audit),
  })
}

export async function resubmitRequisition(id: number, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<PurchaseRequisition>>(`${BASE}/requisitions/${id}/resubmit`, {
    method: 'POST',
    ...withAudit({}, audit),
  })
}

export async function fetchOrders(params: ListOrdersParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<ProcurementListResponse<PurchaseOrder>>(`${BASE}/orders${query}`)
}

export async function fetchOrder(id: number) {
  return apiFetch<ProcurementItemResponse<PurchaseOrder>>(`${BASE}/orders/${id}`)
}

export async function createOrderFromPr(
  prId: number,
  payload: { supplier_id?: number; expected_delivery_date?: string; default_unit_cost?: number; items?: Array<{ purchase_requisition_item_id: number; unit_cost: number }> },
  audit?: AuditMeta,
) {
  return apiFetch<ProcurementItemResponse<PurchaseOrder>>(`${BASE}/orders`, {
    method: 'POST',
    body: JSON.stringify({ purchase_requisition_id: prId, ...payload }),
    ...withAudit({}, audit),
  })
}

export async function updateOrder(
  id: number,
  payload: { supplier_id?: number; expected_delivery_date?: string; items?: Array<{ id: number; qty_ordered?: number; unit_cost?: number }> },
  audit?: AuditMeta,
) {
  return apiFetch<ProcurementItemResponse<PurchaseOrder>>(`${BASE}/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function sendOrder(id: number, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<PurchaseOrder>>(`${BASE}/orders/${id}/send`, {
    method: 'POST',
    ...withAudit({}, audit),
  })
}

export async function cancelOrder(id: number, reason: string, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<PurchaseOrder>>(`${BASE}/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    ...withAudit({}, audit),
  })
}

export async function runThreeWayMatch(orderId: number, audit?: AuditMeta) {
  return apiFetch<{ data: ThreeWayMatch; message?: string }>(`${BASE}/orders/${orderId}/match`, {
    method: 'POST',
    ...withAudit({}, audit),
  })
}

export async function approveThreeWayMatch(orderId: number, audit?: AuditMeta) {
  return apiFetch<{ data: ThreeWayMatch; message?: string }>(`${BASE}/orders/${orderId}/match/approve`, {
    method: 'POST',
    ...withAudit({}, audit),
  })
}

export async function fetchReceivingReports(params: ListReceivingParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<ProcurementListResponse<ReceivingReport>>(`${BASE}/receiving-reports${query}`)
}

export async function fetchReceivingReport(id: number) {
  return apiFetch<ProcurementItemResponse<ReceivingReport>>(`${BASE}/receiving-reports/${id}`)
}

export async function createReceivingReport(
  poId: number,
  payload: { supplier_dr_number?: string; remarks?: string; items: ReceivingReportItem[] },
  audit?: AuditMeta,
) {
  return apiFetch<ProcurementItemResponse<ReceivingReport>>(`${BASE}/receiving-reports`, {
    method: 'POST',
    body: JSON.stringify({ purchase_order_id: poId, ...payload }),
    ...withAudit({}, audit),
  })
}

export async function updateReceivingReport(
  id: number,
  payload: { supplier_dr_number?: string; remarks?: string; items?: ReceivingReportItem[] },
  audit?: AuditMeta,
) {
  return apiFetch<ProcurementItemResponse<ReceivingReport>>(`${BASE}/receiving-reports/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function confirmReceivingReport(id: number, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<ReceivingReport>>(`${BASE}/receiving-reports/${id}/confirm`, {
    method: 'POST',
    ...withAudit({}, audit),
  })
}

export async function createInvoice(payload: Record<string, unknown>, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<SupplierInvoice>>(`${BASE}/invoices`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function fetchInvoice(id: number) {
  return apiFetch<ProcurementItemResponse<SupplierInvoice>>(`${BASE}/invoices/${id}`)
}

export async function updateInvoice(id: number, payload: Record<string, unknown>, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<SupplierInvoice>>(`${BASE}/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function fetchPayables(params: ListPayablesParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<ProcurementListResponse<Payable>>(`${BASE}/payables${query}`)
}

export async function fetchPayablesAging() {
  return apiFetch<{ data: PayablesAging }>(`${BASE}/payables/aging`)
}

export async function createPayableFromPo(poId: number, audit?: AuditMeta) {
  return apiFetch<ProcurementItemResponse<Payable>>(`${BASE}/payables`, {
    method: 'POST',
    body: JSON.stringify({ purchase_order_id: poId }),
    ...withAudit({}, audit),
  })
}

export async function recordPayment(
  id: number,
  payload: { amount: number; payment_date?: string; payment_method?: string },
  audit?: AuditMeta,
) {
  return apiFetch<ProcurementItemResponse<Payable>>(`${BASE}/payables/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...withAudit({}, audit),
  })
}

export async function fetchRequisitionReport(params: ReportParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<{ data: RequisitionReport }>(`${BASE}/requisitions/report${query}`)
}

export async function fetchOrderReport(params: ReportParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<{ data: OrderReport }>(`${BASE}/orders/report${query}`)
}

export async function fetchReceivingReportList(params: ReportParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<{ data: Array<Record<string, unknown>> }>(`${BASE}/receiving-reports/report${query}`)
}

export async function fetchMatchingReport(params: ReportParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<ProcurementListResponse<MatchingReportRow>>(`${BASE}/matching/report${query}`)
}

export async function fetchProcurementAuditTrail(params: ReportParams = {}) {
  const query = buildQuery(params as Record<string, string | undefined>)
  return apiFetch<{ data: ProcurementAuditTrail }>(`${BASE}/audit-trail${query}`)
}

export function procurementStatusPillClass(status: string) {
  const normalized = String(status || '').toLowerCase()
  if (['approved', 'sent', 'confirmed', 'paid', 'completed', 'success', 'approved_for_payment'].includes(normalized)) {
    return 'success'
  }
  if (['rejected', 'cancelled', 'discrepancy', 'failed', 'error'].includes(normalized)) {
    return 'error'
  }
  return 'pending'
}

export function formatProcurementDateTime(value: string | null | undefined) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString()
}

export function formatMoney(value: number | null | undefined) {
  return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
