import type { CashCountSheetPrintInput } from '../../../types/cashCount'
import {
  computeCashVariance,
  computePhysicalCashTotal,
  formatVarianceLabel,
} from '../../../types/cashCount'
import { roundMoney } from '../../../utils/vat'
import {
  RECEIPT_WIDTH,
  centerText,
  clipLine,
  divider,
  formatMoney,
  formatPrintTimestamp,
  pushMoneyLines,
} from './printLayoutUtils'

function pushCountLine(rows: string[], label: string, value: number | string, width = RECEIPT_WIDTH) {
  const text = String(value)
  const gap = Math.max(1, width - label.length - text.length)
  rows.push(clipLine(`${label}${' '.repeat(gap)}${text}`, width))
}

function pushDenomRow(rows: string[], denom: number, qty: number, amount: number, width = RECEIPT_WIDTH) {
  const denomLabel = denom >= 1 ? `${denom}` : String(denom)
  const qtyText = qty > 0 ? String(qty) : '-'
  const amountText = formatMoney(amount)
  const colWidths = [8, 6, width - 14]
  const line = [
    denomLabel.padEnd(colWidths[0]),
    qtyText.padStart(colWidths[1]),
    amountText.padStart(colWidths[2]),
  ].join('')
  rows.push(clipLine(line, width))
}

export function buildCashCountSheetBody(input: CashCountSheetPrintInput) {
  const { config, report, activeSeriesNo, cashierName, denominations, coinsOther, printedAt } = input
  const width = RECEIPT_WIDTH
  const rows: string[] = []
  const timestamp = printedAt ? printedAt.toLocaleString() : formatPrintTimestamp()
  const startingBalance = report.starting_balance ?? 0
  const cashPayment = report.payment_cash ?? report.cash_in_drawer ?? 0
  const cashToRemit =
    report.cash_to_remit ?? report.drawer_total ?? roundMoney(startingBalance + cashPayment)
  const physicalTotal = computePhysicalCashTotal(denominations, coinsOther)
  const variance = computeCashVariance(physicalTotal, cashToRemit)
  const varianceLabel = formatVarianceLabel(variance)

  rows.push(centerText('CASH COUNT SHEET', width))
  rows.push(divider(width))
  pushCountLine(rows, 'TERMINAL:', config.terminal_name || report.machine_name || '-', width)
  pushCountLine(rows, 'SERIES:', activeSeriesNo || '-', width)
  pushCountLine(rows, 'CASHIER:', cashierName || report.cashier_name || '-', width)
  pushCountLine(rows, 'DATE:', timestamp, width)
  rows.push(divider(width))

  rows.push(clipLine('CASH BREAKDOWN', width))
  pushMoneyLines(rows, 'STARTING BALANCE:', startingBalance, width)
  pushMoneyLines(rows, 'CASH PAYMENT:', cashPayment, width)
  pushMoneyLines(rows, 'CASH TO REMIT:', cashToRemit, width)
  rows.push(divider(width))
  rows.push(clipLine('PAYMENT BREAKDOWN', width))
  pushMoneyLines(rows, 'CASH PAYMENT:', report.payment_cash ?? 0, width)
  pushMoneyLines(rows, 'CARD PAYMENT:', report.payment_card ?? 0, width)
  pushMoneyLines(rows, 'E-WALLET PAYMENT:', report.payment_ewallet ?? 0, width)
  pushMoneyLines(rows, 'TOTAL PAYMENTS:', report.total_payments ?? report.total_sales ?? 0, width)
  rows.push(divider(width))
  pushMoneyLines(rows, 'REFERENCE TOTAL:', report.reference_total ?? 0, width)
  rows.push(centerText('*For reconciliation reference only*', width))
  rows.push(divider(width))

  rows.push(clipLine('PHYSICAL COUNT', width))
  rows.push(clipLine('Denom    Qty   Amount', width))
  for (const entry of denominations) {
    const qty = Math.max(0, Math.floor(entry.qty))
    const amount = roundMoney(entry.value * qty)
    pushDenomRow(rows, entry.value, qty, amount, width)
  }
  pushMoneyLines(rows, 'COINS/OTHER:', coinsOther, width)
  rows.push(divider(width))
  pushMoneyLines(rows, 'PHYSICAL TOTAL:', physicalTotal, width)
  pushMoneyLines(rows, 'SYSTEM TOTAL:', cashToRemit, width)
  pushMoneyLines(rows, `VARIANCE (${varianceLabel}):`, variance, width)
  rows.push(divider(width))
  rows.push(clipLine('Counted by: __________________', width))
  rows.push(clipLine('Verified by: __________________', width))

  return rows.join('\n')
}
