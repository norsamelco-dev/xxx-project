export type TestPrintLayoutId = 'short80mm' | 'detailed80mm'

export type ReceiptLayoutId = 'standard80mm' | 'compact80mm'

export type ReportLayoutId = 'standard80mm' | 'detailed80mm'

export const DEFAULT_TEST_PRINT_LAYOUT: TestPrintLayoutId = 'detailed80mm'
export const DEFAULT_RECEIPT_LAYOUT: ReceiptLayoutId = 'standard80mm'
export const DEFAULT_X_REPORT_LAYOUT: ReportLayoutId = 'detailed80mm'
export const DEFAULT_Z_REPORT_LAYOUT: ReportLayoutId = 'detailed80mm'

export const TEST_PRINT_LAYOUT_OPTIONS: Array<{ id: TestPrintLayoutId; label: string }> = [
  { id: 'short80mm', label: 'Short (80mm)' },
  { id: 'detailed80mm', label: 'Detailed (80mm)' },
]

export const RECEIPT_LAYOUT_OPTIONS: Array<{ id: ReceiptLayoutId; label: string }> = [
  { id: 'standard80mm', label: 'Sales Invoice (80mm)' },
  { id: 'compact80mm', label: 'Compact (80mm)' },
]

/** Layouts exposed in the combined Print Layouts menu. */
export const MENU_TEST_PRINT_LAYOUT_OPTIONS = TEST_PRINT_LAYOUT_OPTIONS.filter(
  (option) => option.id === 'detailed80mm',
)

export const MENU_RECEIPT_LAYOUT_OPTIONS = RECEIPT_LAYOUT_OPTIONS.filter((option) => option.id === 'standard80mm')

export const X_REPORT_LAYOUT_OPTIONS: Array<{ id: ReportLayoutId; label: string }> = [
  { id: 'detailed80mm', label: 'X-Reading Detailed (80mm)' },
  { id: 'standard80mm', label: 'X-Reading Standard (80mm)' },
]

export const Z_REPORT_LAYOUT_OPTIONS: Array<{ id: ReportLayoutId; label: string }> = [
  { id: 'detailed80mm', label: 'Z-Reading Detailed (80mm)' },
  { id: 'standard80mm', label: 'Z-Reading Standard (80mm)' },
]

export const MENU_X_REPORT_LAYOUT_OPTIONS = X_REPORT_LAYOUT_OPTIONS.filter((option) => option.id === 'detailed80mm')
export const MENU_Z_REPORT_LAYOUT_OPTIONS = Z_REPORT_LAYOUT_OPTIONS.filter((option) => option.id === 'detailed80mm')

export function resolveTestPrintLayout(layout?: TestPrintLayoutId): TestPrintLayoutId {
  if (layout === 'detailed80mm') {
    return layout
  }
  return DEFAULT_TEST_PRINT_LAYOUT
}

export function resolveReceiptLayout(layout?: ReceiptLayoutId): ReceiptLayoutId {
  if (layout === 'standard80mm') {
    return layout
  }
  return DEFAULT_RECEIPT_LAYOUT
}

export function resolveXReportLayout(layout?: ReportLayoutId): ReportLayoutId {
  if (layout === 'standard80mm' || layout === 'detailed80mm') {
    return layout
  }
  return DEFAULT_X_REPORT_LAYOUT
}

export function resolveZReportLayout(layout?: ReportLayoutId): ReportLayoutId {
  if (layout === 'standard80mm' || layout === 'detailed80mm') {
    return layout
  }
  return DEFAULT_Z_REPORT_LAYOUT
}
