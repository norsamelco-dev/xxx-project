import type { ReceiptLayoutId, ReportLayoutId, TestPrintLayoutId } from './printLayouts'
import type { ThemeId } from '../styles/themes'

export type PosConfig = {
  terminal_name: string
  branch: string
  serial_no: string
  ptu_no: string
  min_number: string
  default_printer: string
  default_printer_id?: string
  default_printer_connection?: 'bluetooth' | 'usb' | 'system'
  test_print_layout?: TestPrintLayoutId
  receipt_layout?: ReceiptLayoutId
  x_report_layout?: ReportLayoutId
  z_report_layout?: ReportLayoutId
  ui_theme?: ThemeId
  print_margin_left?: number
  print_margin_right?: number
  print_margin_top?: number
  print_margin_bottom?: number
  api_base_url_primary?: string
  api_base_url_fallback?: string
}
