import type { PosConfig } from '../../../types/config'
import type { ReceiptHeading } from '../../../types/pos'
import type { TestPrintLayoutId } from '../../../types/printLayouts'
import type { PrinterDevice } from '../printerService'
import {
  centerText,
  clipLine,
  divider,
  formatPrintTimestamp,
  normalizeVatRate,
  pushWrappedText,
  RECEIPT_WIDTH,
} from './printLayoutUtils'

export type TestPrintLayoutInput = {
  config: PosConfig
  printer: PrinterDevice
  heading: ReceiptHeading | null
}

function displayValue(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || '—'
}

function formatVatRatePercent(heading: ReceiptHeading | null) {
  const raw =
    typeof heading?.vat_rate === 'number' ? heading.vat_rate : Number(heading?.vat_rate) || 0.12
  const normalized = normalizeVatRate(raw)
  return `${(normalized * 100).toFixed(2)}%`
}

function resolveBranchName(config: PosConfig, heading: ReceiptHeading | null) {
  return displayValue(config.branch_name || heading?.busi_name)
}

function resolveBusinessAddress(config: PosConfig, heading: ReceiptHeading | null) {
  return heading?.busi_addr?.trim() || config.branch?.trim() || ''
}

function appendCompactBusinessProfileLines(
  rows: string[],
  config: PosConfig,
  heading: ReceiptHeading | null,
  width = RECEIPT_WIDTH,
) {
  rows.push(clipLine(`Branch: ${resolveBranchName(config, heading)}`, width))
  const address = resolveBusinessAddress(config, heading)
  if (address) {
    pushWrappedText(rows, `Address: ${address}`, width)
  } else {
    rows.push(clipLine('Address: —', width))
  }
}

function appendDetailedBusinessProfileLines(
  rows: string[],
  config: PosConfig,
  heading: ReceiptHeading | null,
  width = RECEIPT_WIDTH,
) {
  rows.push(clipLine(`Branch: ${resolveBranchName(config, heading)}`, width))
  rows.push(clipLine(`Owner: ${displayValue(heading?.busi_owner)}`, width))
  rows.push(clipLine(`TIN: ${displayValue(heading?.busi_tin)}`, width))
  rows.push(clipLine(`VAT Type: ${displayValue(heading?.busi_vat_type)}`, width))
  rows.push(clipLine(`VAT Rate: ${formatVatRatePercent(heading)}`, width))
  const address = resolveBusinessAddress(config, heading)
  if (address) {
    pushWrappedText(rows, `Address: ${address}`, width)
  } else {
    rows.push(clipLine('Address: —', width))
  }
}

function buildShort80mmTestPrint({ config, printer, heading }: TestPrintLayoutInput) {
  const rows: string[] = []

  rows.push(centerText('TEST PRINT'))
  rows.push(divider())
  appendCompactBusinessProfileLines(rows, config, heading)
  rows.push(divider())
  rows.push(clipLine(`Printer: ${printer.name}`))
  rows.push(clipLine(`Terminal: ${config.terminal_name}`))
  rows.push(clipLine(formatPrintTimestamp()))
  rows.push(centerText('80mm OK'))

  return rows.join('\n')
}

function buildDetailed80mmTestPrint({ config, printer, heading }: TestPrintLayoutInput) {
  const rows: string[] = []
  const connection =
    printer.connectionType === 'bluetooth'
      ? 'Bluetooth'
      : printer.connectionType === 'usb'
        ? 'USB'
        : printer.connectionType === 'system'
          ? 'System'
          : 'Unknown'

  rows.push(centerText('TEST PRINT'))
  rows.push(divider())
  appendDetailedBusinessProfileLines(rows, config, heading)
  rows.push(divider())
  rows.push(clipLine(`Printer: ${printer.name}`))
  rows.push(clipLine(`Terminal: ${config.terminal_name}`))
  rows.push(clipLine(`Connection: ${connection}`))
  rows.push(clipLine(`MIN: ${config.min_number}`))
  rows.push(clipLine(`PTU: ${config.ptu_no}`))
  rows.push(clipLine(`Serial: ${config.serial_no}`))
  rows.push(clipLine(formatPrintTimestamp()))
  rows.push(divider())
  rows.push(centerText('80mm paper OK'))

  return rows.join('\n')
}

const testPrintBuilders: Record<TestPrintLayoutId, (input: TestPrintLayoutInput) => string> = {
  short80mm: buildShort80mmTestPrint,
  detailed80mm: buildDetailed80mmTestPrint,
}

export function buildTestPrintByLayout(layoutId: TestPrintLayoutId, input: TestPrintLayoutInput) {
  return testPrintBuilders[layoutId](input)
}
