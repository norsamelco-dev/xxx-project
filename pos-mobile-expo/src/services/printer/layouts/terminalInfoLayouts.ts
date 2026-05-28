import type { PosConfig } from '../../../types/config'
import type { TerminalLookup } from '../../../types/pos'
import { centerText, clipLine, divider, formatPrintTimestamp } from './printLayoutUtils'

export type TerminalInfoLayoutInput = {
  config: PosConfig
  terminal?: TerminalLookup | null
  printedAt?: Date
}

function formatOrDisplay(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) {
    return '-'
  }
  return String(Math.floor(Number(value))).padStart(8, '0')
}

function formatOrRange(terminal?: TerminalLookup | null) {
  const start = terminal?.or_start
  const end = terminal?.or_end
  if (start == null && end == null) {
    return '-'
  }
  return `${formatOrDisplay(start)} - ${formatOrDisplay(end)}`
}

export function buildTerminalInfoBody({ config, terminal, printedAt }: TerminalInfoLayoutInput) {
  const rows: string[] = []
  const branch = terminal?.branch || config.branch || '-'
  const status = terminal?.is_active === false ? 'Inactive' : 'Active'
  const currentOr = terminal?.current_or != null ? formatOrDisplay(terminal.current_or) : '-'
  const timestamp = printedAt ? printedAt.toLocaleString() : formatPrintTimestamp()

  rows.push(centerText('TERMINAL INFORMATION'))
  rows.push(divider())
  rows.push(clipLine(`Terminal: ${config.terminal_name || '-'}`))
  rows.push(clipLine(`Branch: ${branch}`))
  rows.push(clipLine(`MIN #: ${config.min_number || terminal?.min_number || '-'}`))
  rows.push(clipLine(`Serial #: ${config.serial_no || terminal?.serial_no || '-'}`))
  rows.push(clipLine(`PTU #: ${config.ptu_no || terminal?.ptu_no || '-'}`))
  rows.push(clipLine(`Current OR: ${currentOr}`))
  rows.push(clipLine(`OR range: ${formatOrRange(terminal)}`))
  rows.push(clipLine(`Status: ${status}`))
  rows.push(clipLine(`Default printer: ${config.default_printer || '-'}`))
  rows.push(divider())
  rows.push(clipLine(`Printed: ${timestamp}`))

  return rows.join('\n')
}
