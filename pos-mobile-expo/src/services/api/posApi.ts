import { apiClient } from './client'
import type {
  CheckoutResult,
  PosReport,
  PosSummary,
  ProductLookup,
  SeriesCloseRequirements,
  SalesSeries,
  TerminalLookup,
} from '../../types/pos'
import type {
  PosTransactionReceipt,
  PosVoidResult,
  SalesItemRow,
  SalesSeriesRow,
  SalesTransactionRow,
} from '../../types/sales'
import type { ReceiptHeading } from '../../types/pos'

export type FifoCartLine = {
  id: number
  batch_id: string
  barcode: string
  description: string
  brand: string
  unit: string
  qty: number
  price: number
  total: number
}

export type PosCartLine = {
  id: number
  batch_id: string
  barcode: string
  description: string
  brand: string
  unit: string
  qty: number
  price: number
  total: number
  product_image_path?: string | null
}

export async function lookupTerminal(machineName: string) {
  const response = await apiClient.get<{ data: TerminalLookup }>('/api/pos/terminals/lookup', {
    params: { machine_name: machineName },
  })
  return response.data.data
}

export async function lookupProduct(barcode: string) {
  const response = await apiClient.get<{ data: ProductLookup }>('/api/pos/products/lookup', {
    params: { barcode },
  })
  return response.data.data
}

export async function searchProducts(query: string) {
  const response = await apiClient.get<{ data: ProductLookup[] }>('/api/pos/products/search', {
    params: { q: query },
  })
  return response.data.data
}

export async function listActiveSeries(machineName: string) {
  const response = await apiClient.get<{ data: SalesSeries[] }>('/api/pos/series/active', {
    params: { machine_name: machineName },
  })
  return response.data.data
}

export async function createSeries(machineName: string) {
  const response = await apiClient.post<{
    data: { full_series_no: string; next_orsi: number; next_orsi_display: string }
  }>('/api/pos/series', { machine_name: machineName })
  return response.data.data
}

export async function getStartingBalance(seriesNo: string) {
  const response = await apiClient.get<{
    data: { full_series_no: string; starting_balance: number | null }
  }>(`/api/pos/series/${encodeURIComponent(seriesNo)}/starting-balance`)
  return response.data.data
}

export async function setStartingBalance(seriesNo: string, startingBalance: number) {
  const response = await apiClient.post<{
    data: { full_series_no: string; starting_balance: number }
  }>(`/api/pos/series/${encodeURIComponent(seriesNo)}/starting-balance`, {
    starting_balance: startingBalance,
  })
  return response.data.data
}

export async function closeSeries(seriesNo: string, machineName: string) {
  const response = await apiClient.post<{
    data: { full_series_no: string; lockbatch: string }
  }>(`/api/pos/series/${encodeURIComponent(seriesNo)}/close`, {
    machine_name: machineName,
  })
  return response.data.data
}

export async function getSeriesCloseRequirements(seriesNo: string, machineName: string) {
  const response = await apiClient.get<{ data: SeriesCloseRequirements }>(
    `/api/pos/series/${encodeURIComponent(seriesNo)}/close-requirements`,
    {
      params: { machine_name: machineName },
    },
  )
  return response.data.data
}

export async function markSeriesReportPrinted(seriesNo: string, machineName: string, reportType: 'X' | 'Z') {
  const response = await apiClient.post<{ data: SeriesCloseRequirements }>(
    `/api/pos/series/${encodeURIComponent(seriesNo)}/reports/printed`,
    {
      machine_name: machineName,
      report_type: reportType,
    },
  )
  return response.data.data
}

export async function upsertCartLine(payload: {
  barcode: string
  batch_id: string
  description: string
  brand: string
  unit: string
  qty: number
  price: number
  total: number
}) {
  const response = await apiClient.post<{ data: { ok: true } }>('/api/pos/cart/line', payload)
  return response.data.data
}

export async function addToCartFifo(payload: { barcode: string; qty: number }) {
  const response = await apiClient.post<{
    data: {
      ok: true
      barcode: string
      product_image_path?: string | null
      lines: FifoCartLine[]
    }
  }>('/api/pos/cart/add', payload)
  return response.data.data
}

export async function removeCartLine(payload: { barcode: string; batch_id: string }) {
  const response = await apiClient.post<{ data: { ok: true } }>('/api/pos/cart/line/remove', payload)
  return response.data.data
}

export async function clearCart() {
  const response = await apiClient.post<{ data: { ok: true } }>('/api/pos/cart/clear')
  return response.data.data
}

export async function getCartLines() {
  const response = await apiClient.get<{ data: PosCartLine[] }>('/api/pos/cart')
  return response.data.data
}

export async function getSummary(machineName: string, seriesNo?: string) {
  const response = await apiClient.get<{ data: PosSummary }>('/api/pos/summary', {
    params: { machine_name: machineName, series_no: seriesNo },
  })
  return response.data.data
}

export async function checkout(payload: {
  machine_name: string
  sales_series_no: string
  payment_method: string
  payment_ref_no?: string
  amt_tendered: number
  discount_rate: number
}) {
  const response = await apiClient.post<{ data: CheckoutResult }>('/api/pos/checkout', payload)
  return response.data.data
}

export async function getXReport(machineName: string) {
  const response = await apiClient.get<{ data: PosReport }>('/api/pos/reports/x', {
    params: { machine_name: machineName },
  })
  return response.data.data
}

export async function runZReport(machineName: string) {
  const response = await apiClient.post<{ data: PosReport }>('/api/pos/reports/z', {
    machine_name: machineName,
  })
  return response.data.data
}

export async function getReceiptHeadingPublic() {
  const response = await apiClient.get<{ data: ReceiptHeading | null }>('/api/receipt-heading/public')
  return response.data.data
}

export async function listPosSalesSeries(machineName: string) {
  const response = await apiClient.get<{ data: SalesSeriesRow[] }>('/api/pos/sales/series', {
    params: { machine_name: machineName },
  })
  return response.data.data
}

export async function listPosSalesTransactions(machineName: string, seriesNo: string) {
  const response = await apiClient.get<{ data: SalesTransactionRow[]; series_no: string }>(
    `/api/pos/sales/series/${encodeURIComponent(seriesNo)}/transactions`,
    { params: { machine_name: machineName } },
  )
  return response.data.data
}

export async function listPosSalesTransactionItems(machineName: string, orsi: number) {
  const response = await apiClient.get<{ data: SalesItemRow[]; orsi: number }>(
    `/api/pos/sales/transactions/${orsi}/items`,
    { params: { machine_name: machineName } },
  )
  return response.data.data
}

export async function voidPosTransaction(machineName: string, orsi: number, voidReason: string) {
  const response = await apiClient.post<{ data: PosVoidResult; message: string }>(
    `/api/pos/sales/transactions/${orsi}/void`,
    { machine_name: machineName, void_reason: voidReason },
  )
  return response.data.data
}

export async function voidPosTransactionItem(
  machineName: string,
  orsi: number,
  itemId: number,
  voidReason: string,
) {
  const response = await apiClient.post<{ data: PosVoidResult; message: string }>(
    `/api/pos/sales/transactions/${orsi}/items/${itemId}/void`,
    { machine_name: machineName, void_reason: voidReason },
  )
  return response.data.data
}

export async function getPosTransactionReceipt(machineName: string, orsi: number) {
  const response = await apiClient.get<{ data: PosTransactionReceipt }>(
    `/api/pos/sales/transactions/${orsi}/receipt`,
    { params: { machine_name: machineName } },
  )
  return response.data.data
}
