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
  product_image_path?: string | null
  unit: string
  batch_id: string
  selling_price: number
  qty_available: number
  qty_total?: number
  batches?: Array<{
    batch_id: string
    qty: number
    expiry_date: string | null
  }>
}

export type SalesSeries = {
  id: number
  full_series_no: string
  machine_id: string
  min_number?: string
  lockbatch?: string
}

export type PosSummary = {
  total_sales: number
  net_sales: number
  vat_amount: number
  qty_sold: number
  transaction_count: number
}

export type SeriesCloseRequirements = {
  full_series_no: string
  machine_id: string
  lockbatch: string
  x_report_printed: boolean
  z_report_printed: boolean
  x_report_printed_at: string | null
  z_report_printed_at: string | null
  can_close: boolean
  missing_reports: Array<'X' | 'Z'>
}

export type PosReport = PosSummary & {
  report_type: 'X' | 'Z'
  machine_name: string
  generated_at: string
  cashier_name?: string
  gross_sales: number
  discount_amount: number
  net_sales_vat_excl: number
  vat_rate: number
  start_orsi: string
  last_orsi: string
  payment_cash: number
  payment_ewallet: number
  payment_card: number
  total_payments: number
  completed_count: number
  cancelled_count: number
  starting_balance: number
  cash_in_drawer: number
  cash_to_remit: number
  reference_total: number
  drawer_total: number
  locked_by?: string
}

export type CheckoutLine = {
  barcode: string
  batch_id: string
  description: string
  brand: string
  unit: string
  category: string
  qty: number
  price: number
  total: number
}

export type CheckoutResult = {
  orsi: number
  orsi_display: string
  next_orsi: number
  next_orsi_display: string
  totals: {
    grossSales: number
    discountRate: number
    discountAmount: number
    vatRate: number
    vatAmount: number
    netSales: number
    grandTotal: number
    itemQtyTotal: number
  }
  amt_tendered: number
  amt_change: number
  payment_method: string
  payment_ref_no?: string
  lines: CheckoutLine[]
}

export type ReceiptHeading = {
  busi_name: string | null
  busi_addr: string | null
  busi_owner: string | null
  busi_vat_type: string | null
  busi_tin: string | null
  vat_rate: number | string | null
  valid_start: string | null
  valid_until: string | null
  developer: string | null
  accreditation_no: string | null
  softwareversion: string | null
  contactdetail: string | null
  business_logo_path?: string | null
  developer_logo_path?: string | null
  print_logo_width?: number | string | null
  print_logo_align?: 'left' | 'center' | 'right' | string | null
  print_logo_enabled?: boolean | number | string | null
}
