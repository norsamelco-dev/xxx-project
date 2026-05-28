import type { CartLine, CartTotals } from '../../../types/cart'
import type { CheckoutResult, ReceiptHeading } from '../../../types/pos'
import type { PosConfig } from '../../../types/config'
import type { ReceiptLayoutId } from '../../../types/printLayouts'
import {
  RECEIPT_WIDTH,
  centerText,
  clipLine,
  divider,
  doubleDivider,
  formatDiscLabel,
  formatHeadingDate,
  formatMoney,
  formatReceiptDate,
  formatVatLabel,
  line,
  normalizeVatRate,
  pushLabelValueLines,
  pushMoneyLines,
  pushWrappedText,
  wrapText,
} from './printLayoutUtils'

const ITEM_COL_WIDTHS = [7, 4, 15, 7, 9]
const ITEM_MAIN_COL_WIDTHS = [7, 4, 29]

export type ReceiptLayoutInput = {
  heading: ReceiptHeading | null
  config: PosConfig
  cashierName: string
  cashierId?: string | number
  seriesNo: string
  orsiDisplay: string
  lines: CartLine[]
  totals: CartTotals
  checkout: CheckoutResult
  paymentRefNo?: string
  transactionDate?: Date
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

function buildItemRows(items: CartLine[], width = RECEIPT_WIDTH) {
  const rows: string[] = []
  rows.push(line(['BATCH', 'QTY', 'DESCRIPTION', 'PRICE', 'TOTAL'], ITEM_COL_WIDTHS))

  for (const item of items) {
    const batch = item.batch_id.slice(0, ITEM_MAIN_COL_WIDTHS[0])
    const qty = String(item.qty)
    const price = formatMoney(item.price)
    const total = formatMoney(item.total)
    const name = item.name
    const descriptionWidth = ITEM_MAIN_COL_WIDTHS[2]

    if (name.length <= descriptionWidth) {
      rows.push(line([batch, qty, name], ITEM_MAIN_COL_WIDTHS))
    } else {
      rows.push(line([batch, qty, name.slice(0, descriptionWidth)], ITEM_MAIN_COL_WIDTHS))
      const indent = ITEM_MAIN_COL_WIDTHS[0] + ITEM_MAIN_COL_WIDTHS[1]
      const wrapWidth = width - indent
      const extraLines = wrapText(name.slice(descriptionWidth), wrapWidth)
      for (const extra of extraLines) {
        rows.push(' '.repeat(indent) + extra)
      }
    }

    // Move price and total to a dedicated second line per item.
    rows.push(line(['', '', '', price, total], ITEM_COL_WIDTHS))
  }

  return rows
}

function buildStandard80mmReceipt(options: ReceiptLayoutInput) {
  const {
    heading,
    config,
    cashierId,
    orsiDisplay,
    lines,
    totals,
    checkout,
    paymentRefNo,
    transactionDate = new Date(),
  } = options
  const width = RECEIPT_WIDTH
  const rows: string[] = []
  const storeName = (heading?.busi_name || 'Linda Lim POS').toUpperCase()
  const rawVatRate =
    typeof heading?.vat_rate === 'number'
      ? heading.vat_rate
      : Number(heading?.vat_rate) || totals.vatRate || 0.12
  const vatRate = normalizeVatRate(rawVatRate)

  for (const nameLine of wrapText(storeName, width)) {
    rows.push(centerText(nameLine, width))
  }

  if (heading?.busi_owner) {
    pushWrappedText(rows, heading.busi_owner, width)
  }

  const address = heading?.busi_addr || config.branch || ''
  pushWrappedText(rows, address, width)

  pushWrappedText(rows, buildVatTinLine(heading), width)
  rows.push(centerText('SALES INVOICE', width))
  rows.push(divider(width))

  pushLabelValueLines(rows, 'INVOICE #: ', orsiDisplay, width)
  pushLabelValueLines(rows, 'MACHINE SN: ', config.serial_no || '', width)
  pushLabelValueLines(rows, 'MIN #: ', config.min_number || '', width)
  pushLabelValueLines(rows, 'PTU #: ', config.ptu_no || '', width)
  pushLabelValueLines(rows, 'DATE ISSUED: ', formatHeadingDate(heading?.valid_start), width)
  pushLabelValueLines(rows, 'VALID UNTIL: ', formatHeadingDate(heading?.valid_until), width)
  pushLabelValueLines(rows, 'CASHIER #: ', String(cashierId ?? ''), width)
  pushLabelValueLines(rows, 'DATE: ', formatReceiptDate(transactionDate), width)
  rows.push(divider(width))

  rows.push(...buildItemRows(lines, width))
  rows.push(doubleDivider(width))

  pushMoneyLines(rows, 'GROSS TOTAL:', totals.grossSales, width)
  pushMoneyLines(rows, `${formatVatLabel(vatRate)}:`, totals.vatAmount, width)
  pushMoneyLines(rows, `${formatDiscLabel(totals.discountRate)}:`, totals.discountAmount, width)
  pushMoneyLines(rows, 'NET TOTAL:', totals.netSales, width)
  pushMoneyLines(rows, 'GRAND TOTAL :', totals.grandTotal, width)
  rows.push('')

  pushMoneyLines(rows, 'AMT TENDERED:', checkout.amt_tendered, width)
  pushMoneyLines(rows, 'CHANGE:', checkout.amt_change, width)
  rows.push('')
  pushLabelValueLines(rows, 'PAYMENT METHOD: ', checkout.payment_method, width)
  pushLabelValueLines(rows, 'TRAN. REFERENCE NO.: ', paymentRefNo || checkout.payment_ref_no || 'N/A', width)

  rows.push(divider(width))
  rows.push('SOLD TO :')
  rows.push('NAME :')
  rows.push('_'.repeat(width))
  rows.push('ADDRESS :')
  rows.push('_'.repeat(width))
  rows.push('TIN :')
  rows.push('_'.repeat(width))
  rows.push('BUSINESS STYLE :')
  rows.push('_'.repeat(width))
  rows.push(divider(width))

  if (heading?.developer) {
    pushLabelValueLines(rows, 'POWERED BY: ', heading.developer, width)
  }
  if (heading?.accreditation_no) {
    pushLabelValueLines(rows, 'ACCREDITATION NO.: ', heading.accreditation_no, width)
  }
  if (heading?.contactdetail) {
    pushLabelValueLines(rows, 'SUPPORT / SALES: ', heading.contactdetail, width)
  }

  rows.push('')
  rows.push(centerText('THIS INVOICE/RECEIPT SHALL BE VALID FOR', width))
  rows.push(centerText('(5) YEARS', width))
  rows.push(centerText('FROM THE DATE OF ATP/PTU', width))

  return rows.join('\n')
}

function buildCompact80mmReceipt(options: ReceiptLayoutInput) {
  const { heading, config, cashierName, seriesNo, orsiDisplay, lines, totals, checkout } = options
  const width = RECEIPT_WIDTH
  const rows: string[] = []
  const storeName = (heading?.busi_name || 'Linda Lim POS').toUpperCase()

  rows.push(clipLine(storeName.padStart((width + storeName.length) / 2)))
  rows.push(divider())
  rows.push(clipLine(`${cashierName} · ORN ${orsiDisplay}`))
  rows.push(clipLine(`${seriesNo} · ${new Date().toLocaleString()}`))
  rows.push(divider())

  for (const item of lines) {
    rows.push(clipLine(`${item.name} x${item.qty}`))
    rows.push(clipLine(item.total.toFixed(2).padStart(width)))
  }

  rows.push(divider())
  rows.push(clipLine(`TOTAL: ${totals.grandTotal.toFixed(2)}`.padStart(width)))
  rows.push(
    clipLine(
      `${checkout.payment_method} · Tnd ${checkout.amt_tendered.toFixed(2)} · Chg ${checkout.amt_change.toFixed(2)}`,
    ),
  )
  rows.push(clipLine(`MIN ${config.min_number} · PTU ${config.ptu_no} · SN ${config.serial_no}`))
  rows.push(centerText('Thank you!'))

  return rows.join('\n')
}

const receiptBuilders: Record<ReceiptLayoutId, (input: ReceiptLayoutInput) => string> = {
  standard80mm: buildStandard80mmReceipt,
  compact80mm: buildCompact80mmReceipt,
}

export function buildReceiptByLayout(layoutId: ReceiptLayoutId, input: ReceiptLayoutInput) {
  return receiptBuilders[layoutId](input)
}
