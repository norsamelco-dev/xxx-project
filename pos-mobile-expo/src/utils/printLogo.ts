import type { ReceiptHeading } from '../types/pos'
import { getApiBaseUrl } from '../services/api/client'

export type PrintLogoAlign = 'left' | 'center' | 'right'

const MIN_LOGO_WIDTH = 80
const MAX_LOGO_WIDTH = 384
const PAPER_WIDTH_DOTS = 384

export function normalizePrintLogoWidth(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 240
  }
  return Math.max(MIN_LOGO_WIDTH, Math.min(MAX_LOGO_WIDTH, Math.round(parsed)))
}

export function normalizePrintLogoAlign(value: unknown): PrintLogoAlign {
  const align = String(value || 'center').trim().toLowerCase()
  if (align === 'left' || align === 'right') {
    return align
  }
  return 'center'
}

export function isPrintLogoEnabled(heading: ReceiptHeading | null | undefined) {
  if (!heading) {
    return false
  }

  const enabled = heading.print_logo_enabled
  if (enabled === false || enabled === 0 || enabled === '0') {
    return false
  }

  return Boolean(heading.business_logo_path)
}

export function resolveBusinessLogoUrl(heading: ReceiptHeading | null | undefined) {
  const logoPath = heading?.business_logo_path
  if (!logoPath) {
    return null
  }

  if (/^https?:\/\//i.test(logoPath)) {
    return logoPath
  }

  return `${getApiBaseUrl()}${logoPath.startsWith('/') ? logoPath : `/${logoPath}`}`
}

export function getPrintLogoPreviewStyle(heading: ReceiptHeading | null | undefined) {
  const widthDots = normalizePrintLogoWidth(heading?.print_logo_width)
  const align = normalizePrintLogoAlign(heading?.print_logo_align)
  const widthPercent = Math.round((widthDots / PAPER_WIDTH_DOTS) * 100)

  return {
    uri: resolveBusinessLogoUrl(heading),
    widthPercent,
    align,
    alignSelf: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
  } as const
}
