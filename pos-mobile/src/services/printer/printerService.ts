import { Platform } from 'react-native'
import type { CartLine, CartTotals } from '../../types/cart'
import type { CheckoutResult, ReceiptHeading } from '../../types/pos'
import type { PosConfig } from '../../types/config'

export type PrinterDevice = {
  id: string
  name: string
}

const MOCK_PRINTERS: PrinterDevice[] = [
  { id: 'pos-80-usb', name: 'POS-80 (USB)' },
  { id: 'pos-80-bt', name: 'POS-80 (Bluetooth)' },
  { id: 'generic-escpos', name: 'Generic ESC/POS' },
]

export async function listPrinters(): Promise<PrinterDevice[]> {
  if (Platform.OS === 'windows') {
    return MOCK_PRINTERS
  }

  return MOCK_PRINTERS
}

function line(columns: string[], widths: number[]) {
  return columns
    .map((value, index) => {
      const width = widths[index]
      const text = String(value)
      return text.length > width ? text.slice(0, width) : text.padEnd(width, ' ')
    })
    .join('')
}

export function buildReceiptText(options: {
  heading: ReceiptHeading | null
  config: PosConfig
  cashierName: string
  seriesNo: string
  orsiDisplay: string
  lines: CartLine[]
  totals: CartTotals
  checkout: CheckoutResult
}) {
  const { heading, config, cashierName, seriesNo, orsiDisplay, lines, totals, checkout } = options
  const width = 42
  const divider = '-'.repeat(width)
  const rows: string[] = []

  rows.push((heading?.busi_name || 'Linda Lim POS').toUpperCase().padStart((width + (heading?.busi_name || 'Linda Lim POS').length) / 2))
  rows.push(config.branch || heading?.busi_addr || '')
  rows.push(divider)
  rows.push(`Cashier: ${cashierName}`)
  rows.push(`Series: ${seriesNo}`)
  rows.push(`ORN: ${orsiDisplay}`)
  rows.push(`Date: ${new Date().toLocaleString()}`)
  rows.push(divider)
  rows.push(line(['Item', 'Qty', 'Amount'], [24, 5, 13]))
  rows.push(divider)

  for (const item of lines) {
    rows.push(item.name.slice(0, width))
    rows.push(line(['', String(item.qty), item.total.toFixed(2)], [24, 5, 13]))
  }

  rows.push(divider)
  rows.push(`Gross Sales: ${totals.grossSales.toFixed(2)}`.padStart(width))
  rows.push(`Discount: ${totals.discountAmount.toFixed(2)}`.padStart(width))
  rows.push(`VAT (12%): ${totals.vatAmount.toFixed(2)}`.padStart(width))
  rows.push(`Net Total: ${totals.netSales.toFixed(2)}`.padStart(width))
  rows.push(`TOTAL: ${totals.grandTotal.toFixed(2)}`.padStart(width))
  rows.push(divider)
  rows.push(`Payment: ${checkout.payment_method}`)
  rows.push(`Tendered: ${checkout.amt_tendered.toFixed(2)}`)
  rows.push(`Change: ${checkout.amt_change.toFixed(2)}`)
  rows.push(divider)
  rows.push(`PTU: ${config.ptu_no}`)
  rows.push(`Serial: ${config.serial_no}`)
  rows.push('')
  rows.push('Thank you for your purchase!'.padStart(28))

  return rows.join('\n')
}

export async function printReceipt(text: string, printerName: string) {
  if (Platform.OS === 'windows') {
    console.log(`[PRINT:${printerName}]\n${text}`)
    return { ok: true, platform: 'windows' }
  }

  console.log(`[PRINT:${printerName}]\n${text}`)
  return { ok: true, platform: 'android' }
}

export async function printReport(title: string, body: string, printerName: string) {
  const text = `${title}\n${'='.repeat(32)}\n${body}\n`
  return printReceipt(text, printerName)
}
