import { apiFetch } from './api'
import type { AuditMeta } from './audit'
import type { DashboardGroupBy } from './dashboardXUtils'

export type DashboardFilters = {
  start_date: string
  end_date: string
  group_by?: DashboardGroupBy | string
}

export type DashboardOverviewCards = {
  totalSalesToday: number
  totalSalesWeek: number
  totalSalesMonth: number
  totalTransactions: number
  activeMachines: number
  activeUsers: number
}

export type DashboardInventoryAlerts = {
  lowStockAlerts: number
  outOfStockItems: number
  nearExpiryItems: number
}

export type SalesTrendPoint = {
  period: string
  totalSales: number
  transactions: number
}

export type DailySalesLastMonth = {
  start_date: string
  end_date: string
  points: SalesTrendPoint[]
}

export type DamageReportSummary = {
  draftReportsOpen: number
  reportsCreatedInRange: number
  reportsSyncedInRange: number
  totalQtyDamaged: number
  totalLineItems: number
  syncLogsTotal: number
  syncLogsSuccess: number
  syncLogsFailed: number
}

export type DamageReasonRow = {
  reasonLabel: string
  totalQty: number
  lineItems: number
}

export type DamageProductRow = {
  productName: string
  qtyDeducted: number
  qtyRequested: number
}

export type DamageSyncTrendPoint = {
  period: string
  syncCount: number
  successCount: number
  failedCount: number
}

export type DashboardOverviewResponse = {
  filters: DashboardFilters
  overview: DashboardOverviewCards
  alerts: DashboardInventoryAlerts
  salesTrendSnapshot: SalesTrendPoint[]
  dailySalesLastMonth: DailySalesLastMonth
  damageReports: DamageReportSummary
  topDamageReasons: DamageReasonRow[]
}

export type DashboardDamageReportsResponse = {
  filters: DashboardFilters
  summary: DamageReportSummary
  topReasons: DamageReasonRow[]
  topProducts: DamageProductRow[]
  syncTrends: DamageSyncTrendPoint[]
  syncTrendSnapshot: DamageSyncTrendPoint[]
  notes: string[]
}

export type TopProductRow = {
  productName: string
  category: string
  quantity: number
  totalSales: number
}

export type SalesByCategoryRow = {
  category: string
  totalSales: number
  quantity: number
}

export type PeakHourRow = {
  hour: string
  transactions: number
  totalSales: number
}

export type DiscountsAndVoids = {
  discountsTotal: number
  discountedTransactions: number
  nonVoidedTransactions: number
  voidedTransactions: number
  voidedAmount: number
  voidedItems: number
  voidedItemsAmount: number
}

export type DashboardSalesResponse = {
  filters: DashboardFilters
  trends: SalesTrendPoint[]
  dailySalesLastMonth: DailySalesLastMonth
  topProducts: TopProductRow[]
  salesByCategory: SalesByCategoryRow[]
  peakHours: PeakHourRow[]
  discountsAndVoids: DiscountsAndVoids
}

export type DashboardInventory = {
  totalProducts: number
  lowStockAlerts: number
  outOfStockItems: number
  nearExpiryItems: number
  stockMovement: {
    stockInTotal: number
    stockRemainingTotal: number
    estimatedStockOut: number
  }
  notes: string[]
}

export type DashboardInventoryResponse = {
  inventory: DashboardInventory
}

export type DashboardFinancial = {
  cashVsNonCash: {
    cash: number
    nonCash: number
  }
  refundsAndReturns: {
    estimatedAmount: number
    estimatedTransactions: number
    note: string
  }
  netProfit: {
    grossSales: number
    estimatedCogs: number
    estimatedNetProfit: number
    note: string
  }
  taxCollected: number
}

export type DashboardFinancialResponse = {
  filters: Pick<DashboardFilters, 'start_date' | 'end_date'>
  financial: DashboardFinancial
}

type DateFilterParams = {
  startDate: string
  endDate: string
  groupBy?: DashboardGroupBy
  audit?: AuditMeta
}

function buildParams({ startDate, endDate, groupBy }: DateFilterParams) {
  const params = new URLSearchParams()
  params.set('start_date', startDate)
  params.set('end_date', endDate)

  if (groupBy) {
    params.set('group_by', groupBy)
  }

  return params
}

export function fetchDashboardOverview({ startDate, endDate, groupBy, audit }: DateFilterParams) {
  const params = buildParams({ startDate, endDate, groupBy })
  return apiFetch<DashboardOverviewResponse>(`/api/dashboardx/overview?${params.toString()}`, { audit })
}

export function fetchDashboardSales({ startDate, endDate, groupBy, audit }: DateFilterParams) {
  const params = buildParams({ startDate, endDate, groupBy })
  return apiFetch<DashboardSalesResponse>(`/api/dashboardx/sales?${params.toString()}`, { audit })
}

export function fetchDashboardInventory(audit?: AuditMeta) {
  return apiFetch<DashboardInventoryResponse>('/api/dashboardx/inventory', { audit })
}

export function fetchDashboardFinancial({ startDate, endDate, audit }: Omit<DateFilterParams, 'groupBy'>) {
  const params = buildParams({ startDate, endDate })
  return apiFetch<DashboardFinancialResponse>(`/api/dashboardx/financial?${params.toString()}`, { audit })
}

export function fetchDashboardDamageReports({ startDate, endDate, groupBy, audit }: DateFilterParams) {
  const params = buildParams({ startDate, endDate, groupBy })
  return apiFetch<DashboardDamageReportsResponse>(`/api/dashboardx/damage-reports?${params.toString()}`, { audit })
}
