import type { PosConfig } from '../../../types/config'
import type { PosReport, ReceiptHeading } from '../../../types/pos'
import type { ReportLayoutId } from '../../../types/printLayouts'
import { roundMoney } from '../../../utils/vat'
import {
  RECEIPT_WIDTH,
  centerText,
  clipLine,
  divider,
  doubleDivider,
  formatMoney,
  formatMoneyLines,
  formatReceiptDate,
  formatVatLabel,
  pushLabelValueLines,
  pushMoneyLines,
  pushWrappedText,
  wrapText,
} from './printLayoutUtils'

export type ReportKind = 'X' | 'Z'

export type ReportLayoutInput = {
  heading: ReceiptHeading | null
  config: PosConfig
  cashierName: string
  cashierId?: string | number
  report: PosReport
  reportKind: ReportKind
}

function buildVatTinLine(heading: ReceiptHeading | null) {
  const vatType = heading?.busi_vat_type?.trim() || 'VAT REG TIN'
  const tin = heading?.busi_tin?.trim() || ''
  if (!tin) {
    return vatType
  }
  if (vatType.toUpperCase().includes('TIN')) {
    return `${vatType}: ${tin}`
  }
  return `${vatType}: ${tin}`
}

function pushCountLine(rows: string[], label: string, value: number | string, width = RECEIPT_WIDTH) {
  const text = String(value)
  const gap = Math.max(1, width - label.length - text.length)
  rows.push(clipLine(`${label}${' '.repeat(gap)}${text}`, width))
}

function buildReportHeader(rows: string[], input: ReportLayoutInput, width: number) {
  const { heading, config } = input
  const storeName = (heading?.busi_name || 'Linda Lim POS').toUpperCase()

  for (const nameLine of wrapText(storeName, width)) {
    rows.push(centerText(nameLine, width))
  }

  if (heading?.busi_owner) {
    pushWrappedText(rows, heading.busi_owner, width)
  }

  const address = heading?.busi_addr || config.branch || ''
  pushWrappedText(rows, address, width)
  pushWrappedText(rows, buildVatTinLine(heading), width)
  pushLabelValueLines(rows, 'MIN #: ', config.min_number || '', width)
  pushLabelValueLines(rows, 'MACHINE SN #: ', config.serial_no || '', width)
  pushLabelValueLines(rows, 'PTU #: ', config.ptu_no || '', width)
}

function buildStandard80mmReadingReport(input: ReportLayoutInput) {
  const { config, cashierName, cashierId, report, reportKind } = input
  const width = RECEIPT_WIDTH
  const rows: string[] = []
  const vatRate = report.vat_rate ?? 0.12
  const reportDate = report.generated_at ? new Date(report.generated_at) : new Date()
  const cashierLabel = cashierName || report.cashier_name || 'Cashier'
  const title = reportKind === 'X' ? 'X-READING REPORT' : 'Z-READING REPORT'
  const netSalesLabel =
    reportKind === 'X' ? 'NET SALES (VAT EXCL):' : 'NET SALES (VAT BASE):'

  buildReportHeader(rows, input, width)

  rows.push(divider(width))
  rows.push(centerText(title, width))
  rows.push(divider(width))

  pushLabelValueLines(rows, 'CASHIER 2: ', cashierLabel, width)
  pushLabelValueLines(rows, 'DATE: ', formatReceiptDate(reportDate), width)
  pushLabelValueLines(rows, 'POS TERMINAL #: ', config.terminal_name || report.machine_name, width)
  rows.push(divider(width))
  pushLabelValueLines(rows, 'START OR/SI #: ', report.start_orsi || '00000000', width)
  pushLabelValueLines(rows, 'LAST OR/SI #: ', report.last_orsi || '00000000', width)
  rows.push(divider(width))

  rows.push(clipLine('SALES SUMMARY:', width))
  pushMoneyLines(rows, 'GROSS SALES:', report.gross_sales ?? report.total_sales, width)
  pushMoneyLines(rows, 'LESS DISCOUNT:', report.discount_amount ?? 0, width)
  rows.push(divider(width))
  pushMoneyLines(rows, netSalesLabel, report.net_sales_vat_excl ?? report.net_sales, width)
  pushMoneyLines(rows, `${formatVatLabel(vatRate)}:`, report.vat_amount, width)
  rows.push(divider(width))
  pushMoneyLines(rows, 'TOTAL SALES:', report.total_sales, width)
  rows.push(doubleDivider(width))

  rows.push(clipLine('PAYMENT BREAKDOWN', width))
  pushMoneyLines(rows, 'CASH PAYMENT:', report.payment_cash ?? 0, width)
  pushMoneyLines(rows, 'CARD PAYMENT:', report.payment_card ?? 0, width)
  pushMoneyLines(rows, 'E-WALLET PAYMENT:', report.payment_ewallet ?? 0, width)
  rows.push(divider(width))
  pushMoneyLines(rows, 'TOTAL PAYMENTS:', report.total_payments ?? report.total_sales, width)
  rows.push(divider(width))

  pushCountLine(rows, 'TOTAL ITEM QTY SOLD:', report.qty_sold, width)
  pushCountLine(rows, 'TOTAL TRANSACTION:', report.transaction_count, width)
  pushCountLine(rows, 'COMPLETED:', report.completed_count ?? report.transaction_count, width)
  pushCountLine(rows, 'CANCELLED:', report.cancelled_count ?? 0, width)
  rows.push(divider(width))

  const startingBalance = report.starting_balance ?? 0
  const cashPayment = report.payment_cash ?? report.cash_in_drawer ?? 0
  const cardPayment = report.payment_card ?? 0
  const ewalletPayment = report.payment_ewallet ?? 0
  const cashToRemit =
    report.cash_to_remit ?? report.drawer_total ?? roundMoney(startingBalance + cashPayment)
  const referenceTotal =
    report.reference_total ??
    roundMoney(startingBalance + cashPayment + cardPayment + ewalletPayment)

  rows.push(clipLine('CASH REMITTANCE (CASH ONLY)', width))
  pushMoneyLines(rows, 'STARTING BALANCE:', startingBalance, width)
  pushMoneyLines(rows, 'CASH PAYMENT:', cashPayment, width)
  pushMoneyLines(rows, 'CASH TO REMIT:', cashToRemit, width)
  rows.push(divider(width))
  pushMoneyLines(rows, 'REFERENCE TOTAL:', referenceTotal, width)
  rows.push(centerText('*For reconciliation reference only*', width))
  rows.push(divider(width))

  rows.push('')
  if (reportKind === 'X') {
    for (const line of wrapText(
      'This is an X-Reading report. It provides a summary of all transactions and the total sales collected up to the time of printing. This report is for monitoring and reference purposes only and does not reset the accumulated totals on the POS.',
      width,
    )) {
      rows.push(centerText(line, width))
    }
  } else {
    for (const line of wrapText(
      'This is a Z-Reading report. It provides the final sales summary for the day or shift. Printing this report will reset/clear the accumulated sales totals on the POS and is typically performed at end-of-day closing for official recording and reconciliation.',
      width,
    )) {
      rows.push(centerText(line, width))
    }
  }

  rows.push('')
  rows.push(centerText('*THIS DOCUMENT IS NOT VALID', width))
  rows.push(centerText('FOR CLAIM OF INPUT TAX*', width))

  return rows.join('\n')
}

const reportBuilders: Record<ReportLayoutId, (input: ReportLayoutInput) => string> = {
  standard80mm: buildStandard80mmReadingReport,
}

export function buildReadingReportByLayout(layoutId: ReportLayoutId, input: ReportLayoutInput) {
  return reportBuilders[layoutId](input)
}

export function buildXReadingReport(layoutId: ReportLayoutId, input: Omit<ReportLayoutInput, 'reportKind'>) {
  return buildReadingReportByLayout(layoutId, { ...input, reportKind: 'X' })
}

export function buildZReadingReport(layoutId: ReportLayoutId, input: Omit<ReportLayoutInput, 'reportKind'>) {
  return buildReadingReportByLayout(layoutId, { ...input, reportKind: 'Z' })
}
