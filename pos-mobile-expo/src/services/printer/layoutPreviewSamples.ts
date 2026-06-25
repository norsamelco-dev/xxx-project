import type { CartLine, CartTotals } from '../../types/cart'
import type { PosConfig } from '../../types/config'
import type { PosReport, ReceiptHeading } from '../../types/pos'
import type { ReceiptLayoutInput } from './layouts/receiptLayouts'
import type { ReportKind, ReportLayoutInput } from './layouts/reportLayouts'
import type { TestPrintLayoutInput } from './layouts/testPrintLayouts'
import type { PrinterDevice } from './printerService'
import { computeCartTotals, normalizePriceVatMode, resolveVatRateFromHeading } from '../../utils/vat'

export function getSampleTestPrintLayoutInput(
  config: PosConfig,
  heading: ReceiptHeading | null = null,
): TestPrintLayoutInput {
  const printer: PrinterDevice = {
    id: config.default_printer_id || 'sample-printer',
    name: config.default_printer || 'Sample Printer',
    connectionType: config.default_printer_connection || 'system',
  }

  return { config, printer, heading }
}

export type ReceiptPreviewContext = {
  config: PosConfig
  heading: ReceiptHeading | null
  cashierName: string
  cashierId?: string | number
  seriesNo: string | null
  orsiDisplay: string
  cartLines?: CartLine[]
  cartTotals?: CartTotals
  discountRate?: number
}

const PREVIEW_DEMO_LINES: CartLine[] = [
  {
    id: 'preview-1',
    barcode: '8900000000001',
    name: '290ml Coca-cola',
    category: 'Beverages',
    brand: 'Demo',
    unit: 'pc',
    batch_id: 'B-001',
    qty: 85,
    price: 25,
    total: 2125,
  },
]

export function getReceiptLayoutPreviewInput({
  config,
  heading,
  cashierName,
  cashierId,
  seriesNo,
  orsiDisplay,
  cartLines,
  cartTotals,
  discountRate = 0,
}: ReceiptPreviewContext): ReceiptLayoutInput {
  const lines = cartLines?.length ? cartLines : PREVIEW_DEMO_LINES
  const vatRate = resolveVatRateFromHeading(heading?.vat_rate, heading?.busi_vat_type)
  const priceVatMode = normalizePriceVatMode(heading?.price_vat_mode)
  const totals = cartTotals ?? computeCartTotals(lines, discountRate, vatRate, priceVatMode)

  const checkout = {
    orsi: Number.parseInt(orsiDisplay, 10) || 0,
    orsi_display: orsiDisplay,
    next_orsi: (Number.parseInt(orsiDisplay, 10) || 0) + 1,
    next_orsi_display: String((Number.parseInt(orsiDisplay, 10) || 0) + 1).padStart(8, '0'),
    totals: {
      grossSales: totals.grossSales,
      discountRate: totals.discountRate,
      discountAmount: totals.discountAmount,
      vatRate: totals.vatRate,
      priceVatMode: totals.priceVatMode,
      vatAmount: totals.vatAmount,
      netSales: totals.netSales,
      grandTotal: totals.grandTotal,
      itemQtyTotal: totals.itemQtyTotal,
    },
    amt_tendered: totals.grandTotal,
    amt_change: 0,
    payment_method: 'CASH PAYMENT',
    payment_ref_no: 'N/A',
    lines: lines.map((line) => ({
      barcode: line.barcode,
      batch_id: line.batch_id,
      description: line.name,
      brand: line.brand,
      unit: line.unit,
      category: line.category,
      qty: line.qty,
      price: line.price,
      total: line.total,
    })),
  }

  return {
    heading,
    config,
    cashierName,
    cashierId,
    seriesNo: seriesNo || '',
    orsiDisplay,
    lines,
    totals,
    checkout,
    paymentRefNo: 'N/A',
    transactionDate: new Date(),
  }
}

const SAMPLE_REPORT: PosReport = {
  report_type: 'X',
  machine_name: 'POS-0001',
  sales_series_no: 'POS-0001-20260625-001',
  generated_at: new Date().toISOString(),
  cashier_name: 'cashier1',
  total_sales: 2143,
  net_sales: 1913.39,
  vat_amount: 229.61,
  qty_sold: 87,
  transaction_count: 2,
  gross_sales: 2143,
  discount_amount: 0,
  net_sales_vat_excl: 1913.39,
  vat_rate: 0.12,
  start_orsi: '00000053',
  last_orsi: '00000054',
  payment_cash: 1000,
  payment_ewallet: 643,
  payment_card: 500,
  total_payments: 2143,
  completed_count: 2,
  cancelled_count: 0,
  starting_balance: 500,
  cash_in_drawer: 1000,
  cash_to_remit: 1500,
  reference_total: 2643,
  drawer_total: 1500,
}

export type ReportPreviewContext = {
  config: PosConfig
  heading: ReceiptHeading | null
  cashierName: string
  cashierId?: string | number
  reportKind: ReportKind
  report?: PosReport
}

export function getReportLayoutPreviewInput({
  config,
  heading,
  cashierName,
  cashierId,
  reportKind,
  report = SAMPLE_REPORT,
}: ReportPreviewContext): ReportLayoutInput {
  return {
    heading,
    config,
    cashierName,
    cashierId,
    report: {
      ...report,
      report_type: reportKind,
      machine_name: config.terminal_name || report.machine_name,
    },
    reportKind,
  }
}

/** @deprecated Use getReceiptLayoutPreviewInput */
export function getSampleReceiptLayoutInput(
  config: PosConfig,
  heading: ReceiptHeading | null,
  cashierName = 'Sample Cashier',
  cashierId: string | number = 1,
): ReceiptLayoutInput {
  return getReceiptLayoutPreviewInput({
    config,
    heading,
    cashierName,
    cashierId,
    seriesNo: null,
    orsiDisplay: '00000001',
  })
}
