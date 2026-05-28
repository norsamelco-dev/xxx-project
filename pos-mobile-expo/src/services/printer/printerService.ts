import { Platform } from 'react-native'
import axios from 'axios'
import type { CartLine, CartTotals } from '../../types/cart'
import type { CheckoutResult, PosReport, ReceiptHeading } from '../../types/pos'
import type { PosConfig } from '../../types/config'
import { resolveReceiptLayout, resolveTestPrintLayout, resolveXReportLayout, resolveZReportLayout } from '../../types/printLayouts'
import { discoverPrinters } from './printerDiscovery'
import { buildReceiptByLayout } from './layouts/receiptLayouts'
import { buildXReadingReport, buildZReadingReport } from './layouts/reportLayouts'
import { buildTestPrintByLayout } from './layouts/testPrintLayouts'
import { applyPrintMarginsToText, appendEscPosAutoCut } from './layouts/printLayoutUtils'
import { getReceiptHeadingPublic } from '../api/posApi'
import { reportGlobalConnectionError } from '../../context/NetworkErrorContext'
export { RECEIPT_WIDTH } from './layouts/printLayoutUtils'

export type PrinterDevice = {
  id: string
  name: string
  connectionType?: 'bluetooth' | 'usb' | 'system'
}

export async function listPrinters(): Promise<PrinterDevice[]> {
  return discoverPrinters()
}

export function buildReceiptText(options: {
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
}) {
  const layoutId = resolveReceiptLayout(options.config.receipt_layout)
  const body = buildReceiptByLayout(layoutId, options)
  return applyPrintMarginsToText(body, {
    left: options.config.print_margin_left,
    right: options.config.print_margin_right,
    top: options.config.print_margin_top,
    bottom: options.config.print_margin_bottom,
  })
}

export function buildTestPrintText(options: { config: PosConfig; printer: PrinterDevice }) {
  const layoutId = resolveTestPrintLayout(options.config.test_print_layout)
  const body = buildTestPrintByLayout(layoutId, options)
  return applyPrintMarginsToText(body, {
    left: options.config.print_margin_left,
    right: options.config.print_margin_right,
    top: options.config.print_margin_top,
    bottom: options.config.print_margin_bottom,
  })
}

function getLocalApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_POS_API_URL_LOCAL ||
    (Platform.OS === 'web' ? 'http://127.0.0.1:5000' : '')
  ).replace(/\/+$/, '')
}

async function printOnLocalWindowsHost(
  printerName: string,
  text: string,
  heading?: ReceiptHeading | null,
) {
  const baseUrl = getLocalApiBaseUrl()

  if (!baseUrl) {
    throw new Error('Local API URL is not configured for Windows printing.')
  }

  await axios.post(
    `${baseUrl}/api/local/print`,
    {
      printerName,
      text,
      heading: heading ?? null,
    },
    { timeout: 30000 },
  ).catch((error: unknown) => {
    if (axios.isAxiosError(error) && !error.response) {
      reportGlobalConnectionError({
        source: 'printer-service',
        url: `${baseUrl}/api/local/print`,
        message: error.message,
      })
    }
    throw error
  })
}

export async function printReceipt(
  text: string,
  printerName: string,
  printerId?: string,
  connectionType?: PrinterDevice['connectionType'],
  heading?: ReceiptHeading | null,
) {
  if (Platform.OS === 'android') {
    const targetId = printerId || printerName

    if (connectionType === 'bluetooth' || /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(targetId)) {
      const { printRawText } = await import('linda-printer')
      await printRawText(targetId, text)
      return { ok: true, platform: 'android', connectionType: 'bluetooth' }
    }

    console.log(`[PRINT:${printerName}]\n${text}`)
    return { ok: true, platform: 'android', connectionType: connectionType || 'unknown' }
  }

  if (Platform.OS === 'web') {
    try {
      await printOnLocalWindowsHost(printerName, text, heading)
      return { ok: true, platform: 'web', connectionType: 'system' }
    } catch (error) {
      console.log(`[PRINT:${printerName}]\n${text}`)
      console.warn('Windows host print failed:', error)
      return { ok: true, platform: 'web', connectionType: 'system', fallback: true }
    }
  }

  console.log(`[PRINT:${printerName}]\n${text}`)
  return { ok: true, platform: Platform.OS }
}

export async function printTestPage(
  printer: PrinterDevice,
  config: PosConfig,
  heading?: ReceiptHeading | null,
) {
  const resolvedHeading =
    heading === undefined ? await getReceiptHeadingPublic().catch(() => null) : heading
  const text = appendEscPosAutoCut(buildTestPrintText({ config, printer }))
  return printReceipt(
    text,
    printer.name,
    printer.id,
    printer.connectionType,
    resolvedHeading,
  )
}

export async function printSalesReceipt(
  options: Parameters<typeof buildReceiptText>[0],
  printerName: string,
  printerId?: string,
  connectionType?: PrinterDevice['connectionType'],
) {
  const text = appendEscPosAutoCut(buildReceiptText(options))
  return printReceipt(text, printerName, printerId, connectionType, options.heading)
}

export type ReportPrintOptions = {
  heading: ReceiptHeading | null
  config: PosConfig
  cashierName: string
  cashierId?: string | number
  report: PosReport
}

function buildReportText(options: ReportPrintOptions, variant: 'X' | 'Z') {
  const layoutId =
    variant === 'X' ? resolveXReportLayout(options.config.x_report_layout) : resolveZReportLayout(options.config.z_report_layout)
  const builder = variant === 'X' ? buildXReadingReport : buildZReadingReport
  const body = builder(layoutId, options)
  return applyPrintMarginsToText(body, {
    left: options.config.print_margin_left,
    right: options.config.print_margin_right,
    top: options.config.print_margin_top,
    bottom: options.config.print_margin_bottom,
  })
}

export function buildXReportText(options: ReportPrintOptions) {
  return buildReportText(options, 'X')
}

export function buildZReportText(options: ReportPrintOptions) {
  return buildReportText(options, 'Z')
}

export async function printXReport(
  options: ReportPrintOptions,
  printerName: string,
  printerId?: string,
  connectionType?: PrinterDevice['connectionType'],
) {
  const text = appendEscPosAutoCut(buildXReportText(options))
  return printReceipt(text, printerName, printerId, connectionType, options.heading)
}

export async function printZReport(
  options: ReportPrintOptions,
  printerName: string,
  printerId?: string,
  connectionType?: PrinterDevice['connectionType'],
) {
  const text = appendEscPosAutoCut(buildZReportText(options))
  return printReceipt(text, printerName, printerId, connectionType, options.heading)
}

/** @deprecated Use printXReport or printZReport */
export async function printReport(
  title: string,
  body: string,
  printerName: string,
  printerId?: string,
  connectionType?: PrinterDevice['connectionType'],
  heading?: ReceiptHeading | null,
) {
  const text = `${title}\n${'='.repeat(32)}\n${body}\n`
  return printReceipt(text, printerName, printerId, connectionType, heading)
}
