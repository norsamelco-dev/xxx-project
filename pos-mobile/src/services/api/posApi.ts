import { apiClient } from './client'
import type {
  CheckoutResult,
  PosReport,
  PosSummary,
  ProductLookup,
  SalesSeries,
  TerminalLookup,
} from '../../types/pos'
import type { CartLine } from '../../types/cart'
import type { ReceiptHeading } from '../../types/pos'

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

export async function removeCartLine(payload: { barcode: string; batch_id: string }) {
  const response = await apiClient.post<{ data: { ok: true } }>('/api/pos/cart/line/remove', payload)
  return response.data.data
}

export async function clearCart() {
  const response = await apiClient.post<{ data: { ok: true } }>('/api/pos/cart/clear')
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
  lines: Array<Pick<CartLine, 'barcode' | 'qty' | 'price' | 'batch_id'>>
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
