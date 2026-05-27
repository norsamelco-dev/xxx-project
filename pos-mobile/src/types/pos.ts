export type SessionUser = {
  userId: number
  username: string
  role: string
  fullName: string
}

export type TerminalLookup = {
  terminal_name: string
  serial_no: string
  ptu_no: string
  min_number: string
  current_or: number
  branch: string
  is_active: boolean
}

export type ProductLookup = {
  product_id: number
  barcode: string
  name: string
  category: string
  brand: string
  unit: string
  batch_id: string
  selling_price: number
  qty_available: number
}

export type SalesSeries = {
  id: number
  full_series_no: string
  machine_id: string
  lockbatch?: string
}

export type PosSummary = {
  total_sales: number
  net_sales: number
  vat_amount: number
  qty_sold: number
  transaction_count: number
}

export type PosReport = PosSummary & {
  report_type: 'X' | 'Z'
  machine_name: string
  generated_at: string
}

export type CheckoutResult = {
  orsi: number
  orsi_display: string
  next_orsi: number
  next_orsi_display: string
  totals: {
    grossSales: number
    discountAmount: number
    vatAmount: number
    netSales: number
    grandTotal: number
  }
  amt_tendered: number
  amt_change: number
  payment_method: string
}

export type ReceiptHeading = {
  busi_name: string | null
  busi_addr: string | null
  busi_tin: string | null
  vat_rate: number | string | null
  developer: string | null
  accreditation_no: string | null
  softwareversion: string | null
}
