import type { CheckoutResult } from './pos'

export type SalesSeriesRow = {
  ID: number
  created_at: string | null
  full_series_no: string | null
  machine_id: string | null
  min_number: string | null
  ptu: string | null
  seriesno: number | null
  starting_balance: number | string | null
  totalsales: number | string | null
  vat_amount: number | string | null
  grand_total: number | string | null
  userid: number | null
  username: string | null
  lockbatch: string | null
  transaction_count: number | string | null
  first_orsi: number | string | null
  last_orsi: number | string | null
}

export type SalesTransactionRow = {
  ID: number
  created_at: string | null
  sales_series_no: string | null
  MachineName: string | null
  PTU: string | null
  ORSI: number
  sales_amt: number | string | null
  discountrate: number | string | null
  discount_amount: number | string | null
  sales_vatable_amount: number | string | null
  sales_vat_rate: number | string | null
  sales_price_vat_mode?: string | null
  sales_total_amt: number | string | null
  sales_grandtotal: number | string | null
  amt_tendered: number | string | null
  amt_change: number | string | null
  payment_method: string | null
  payment_ref_no: string | null
  total_item_sold: number | string | null
  customerid: number | null
  userid: number | null
  username: string | null
  VOIDED: string | null
  VOID_REASON: string | null
  line_item_count: number | string | null
}

export type SalesItemRow = {
  ID: number
  created_at: string | null
  sales_series_no: string | null
  ORSI: number
  CATEGORY: string | null
  BATCHID: string | null
  BARCODE: string | null
  DESCRIPTION: string | null
  BRAND: string | null
  UNIT: string | null
  QTY: number | string | null
  PRICE: number | string | null
  TOTAL: number | string | null
  VOIDED: string | null
}

export type PosVoidResult = {
  transaction: SalesTransactionRow
  items: SalesItemRow[]
}

export type PosTransactionReceipt = {
  sales_series_no: string | null
  checkout: CheckoutResult
}
