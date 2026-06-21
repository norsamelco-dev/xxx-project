import type { PosConfig } from '../../types/config'
import type { TerminalLookup } from '../../types/pos'
import { resolveThemeId } from '../../styles/themes'
import {
  DEFAULT_RECEIPT_LAYOUT,
  DEFAULT_TEST_PRINT_LAYOUT,
  DEFAULT_X_REPORT_LAYOUT,
  DEFAULT_Z_REPORT_LAYOUT,
  resolveReceiptLayout,
  resolveTestPrintLayout,
  resolveXReportLayout,
  resolveZReportLayout,
} from '../../types/printLayouts'
import { lookupTerminal } from '../api/posApi'
import { saveConfig } from './configStore'

export function normalizeMinNumber(value: unknown): string {
  if (value == null) {
    return ''
  }
  return String(value).trim()
}

export function resolveBranchCode(config?: Pick<PosConfig, 'branch_code'> | null): string | undefined {
  const code = config?.branch_code?.trim()
  return code || undefined
}

export function formatBranchLabel(config: Pick<PosConfig, 'branch_name' | 'branch_code' | 'branch'>): string {
  const name = config.branch_name?.trim() || config.branch?.trim()
  const code = config.branch_code?.trim()

  if (name && code) {
    return `${name} (${code})`
  }

  if (name) {
    return name
  }

  if (code) {
    return code
  }

  return '-'
}

export function normalizePosConfig(config: PosConfig): PosConfig {
  return {
    ...config,
    min_number: normalizeMinNumber(config.min_number),
    api_base_url_primary: typeof config.api_base_url_primary === 'string' ? config.api_base_url_primary.trim() : '',
    api_base_url_fallback: typeof config.api_base_url_fallback === 'string' ? config.api_base_url_fallback.trim() : '',
    test_print_layout: resolveTestPrintLayout(config.test_print_layout),
    receipt_layout: resolveReceiptLayout(config.receipt_layout),
    x_report_layout: resolveXReportLayout(config.x_report_layout),
    z_report_layout: resolveZReportLayout(config.z_report_layout),
    ui_theme: resolveThemeId(config.ui_theme),
  }
}

export function buildConfigFromTerminal(
  terminal: TerminalLookup,
  partial: Partial<PosConfig> & Pick<PosConfig, 'default_printer'>,
): PosConfig {
  return {
    terminal_name: terminal.terminal_name,
    branch: terminal.branch || terminal.branch_name || '',
    branch_id: terminal.branch_id,
    branch_code: terminal.branch_code,
    branch_name: terminal.branch_name,
    serial_no: terminal.serial_no || '',
    ptu_no: terminal.ptu_no || '',
    min_number: normalizeMinNumber(terminal.min_number),
    test_print_layout: partial.test_print_layout ?? DEFAULT_TEST_PRINT_LAYOUT,
    receipt_layout: partial.receipt_layout ?? DEFAULT_RECEIPT_LAYOUT,
    x_report_layout: partial.x_report_layout ?? DEFAULT_X_REPORT_LAYOUT,
    z_report_layout: partial.z_report_layout ?? DEFAULT_Z_REPORT_LAYOUT,
    ui_theme: resolveThemeId(partial.ui_theme),
    default_printer: partial.default_printer,
    default_printer_id: partial.default_printer_id,
    default_printer_connection: partial.default_printer_connection,
    print_margin_left: partial.print_margin_left,
    print_margin_right: partial.print_margin_right,
    print_margin_top: partial.print_margin_top,
    print_margin_bottom: partial.print_margin_bottom,
  }
}

export function mergeTerminalIntoConfig(config: PosConfig, terminal: TerminalLookup): PosConfig {
  const min_number = normalizeMinNumber(terminal.min_number) || normalizeMinNumber(config.min_number)

  return {
    ...config,
    terminal_name: terminal.terminal_name,
    branch: terminal.branch || terminal.branch_name || config.branch,
    branch_id: terminal.branch_id ?? config.branch_id,
    branch_code: terminal.branch_code ?? config.branch_code,
    branch_name: terminal.branch_name ?? config.branch_name,
    serial_no: terminal.serial_no || config.serial_no,
    ptu_no: terminal.ptu_no || config.ptu_no,
    min_number,
  }
}

/** Refresh terminal identity fields from the server and persist locally (incl. min_number). */
export async function syncTerminalConfigToLocal(config: PosConfig): Promise<PosConfig> {
  const terminal = await lookupTerminal(config.terminal_name, resolveBranchCode(config))
  const next = mergeTerminalIntoConfig(config, terminal)
  await saveConfig(next)
  return next
}
