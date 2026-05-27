import { apiFetch } from './api'

export type AuditMeta = {
  page: string
  action: string
  description: string
  tableName?: string | null
  productBarcode?: string | null
}

export const AUDIT_PAGES = {
  LOGIN: 'Login',
  DASHBOARD_X: 'DashboardX',
  AUDIT_LOGS: 'Audit Logs',
  INVENTORY_PRODUCTS: 'Inventory Workspace > Products',
  INVENTORY_STOCK_BATCH: 'Inventory Workspace > Add Stock Batch',
  INVENTORY_SYNC_HISTORY: 'Inventory Workspace > Sync History',
  DAMAGE_REPORTS: 'Damage Reports Workspace > Reports',
  DAMAGE_SYNC_LOGS: 'Damage Reports Workspace > Sync Logs',
  DAMAGE_REASON_SETTINGS: 'Damage Reports Workspace > Reason Settings',
  SALES_REPORT: 'Sales Report',
  USERS: 'Users',
  RECEIPT_HEADING: 'Business Profile Settings',
  MACHINE_TERMINAL: 'Machine Terminal Registration',
  PROCUREMENT: 'Procurement Workspace',
  PROCUREMENT_REQUISITION: 'Procurement > Purchase Requisition',
  PROCUREMENT_ORDER: 'Procurement > Purchase Order',
  PROCUREMENT_RECEIVING: 'Procurement > Receiving Report',
} as const

export function buildAuditDescription(page: string, detail: string) {
  return `Page: ${page}. ${detail}`
}

export async function recordAuditEvent(meta: AuditMeta) {
  await apiFetch<{ message: string }>('/api/audit-logs/record', {
    method: 'POST',
    body: JSON.stringify({
      page: meta.page,
      action: meta.action,
      description: meta.description,
      table_name: meta.tableName ?? null,
      product_barcode: meta.productBarcode ?? null,
    }),
  })
}
