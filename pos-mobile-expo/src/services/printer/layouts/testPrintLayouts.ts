import type { PosConfig } from '../../../types/config'
import type { TestPrintLayoutId } from '../../../types/printLayouts'
import type { PrinterDevice } from '../printerService'
import { centerText, clipLine, divider, formatPrintTimestamp, RECEIPT_WIDTH } from './printLayoutUtils'

export type TestPrintLayoutInput = {
  config: PosConfig
  printer: PrinterDevice
}

function buildShort80mmTestPrint({ config, printer }: TestPrintLayoutInput) {
  const rows: string[] = []

  rows.push(centerText('TEST PRINT'))
  rows.push(divider())
  rows.push(clipLine(`Printer: ${printer.name}`))
  rows.push(clipLine(`Terminal: ${config.terminal_name}`))
  rows.push(clipLine(formatPrintTimestamp()))
  rows.push(centerText('80mm OK'))

  return rows.join('\n')
}

function buildDetailed80mmTestPrint({ config, printer }: TestPrintLayoutInput) {
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
  rows.push(clipLine(`Printer: ${printer.name}`))
  rows.push(clipLine(`Terminal: ${config.terminal_name}`))
  rows.push(clipLine(`Branch: ${config.branch}`))
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
