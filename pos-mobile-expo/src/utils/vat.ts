import type { CartLine, CartTotals } from '../types/cart'

export type PriceVatMode = 'INCLUSIVE' | 'EXCLUSIVE'

const DEFAULT_VAT_RATE = 0.12
const DEFAULT_PRICE_VAT_MODE: PriceVatMode = 'INCLUSIVE'

export function normalizeVatRateDecimal(value: number | string | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_VAT_RATE
  }
  if (parsed > 1) {
    return parsed / 100
  }
  return parsed
}

export function normalizePriceVatMode(
  value: string | null | undefined,
  fallback: PriceVatMode = DEFAULT_PRICE_VAT_MODE,
): PriceVatMode {
  const normalized = String(value || fallback).trim().toUpperCase()
  return normalized === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE'
}

export function formatPriceVatModeLabel(mode: PriceVatMode | undefined): string {
  return normalizePriceVatMode(mode) === 'EXCLUSIVE' ? '(VAT Exclusive)' : '(VAT Inclusive)'
}

export function resolveVatRateFromHeading(
  vatRate: number | string | null | undefined,
  busiVatType?: string | null,
): number {
  if (String(busiVatType || '').trim().toUpperCase() === 'VAT-EXEMPT TIN') {
    return 0
  }
  return normalizeVatRateDecimal(vatRate)
}

export function computeCartTotals(
  lines: CartLine[],
  discountRate: number,
  vatRate = DEFAULT_VAT_RATE,
  priceVatMode: PriceVatMode = DEFAULT_PRICE_VAT_MODE,
): CartTotals {
  const grossSales = roundMoney(lines.reduce((sum, line) => sum + line.total, 0))
  const normalizedDiscountRate = Math.max(0, discountRate)
  const discountAmount = roundMoney(grossSales * normalizedDiscountRate)
  const taxableGross = roundMoney(grossSales - discountAmount)
  const normalizedRate = normalizeVatRateDecimal(vatRate)
  const mode = normalizePriceVatMode(priceVatMode)

  let vatAmount = 0
  let netSales = taxableGross
  let grandTotal = taxableGross

  if (normalizedRate > 0) {
    if (mode === 'EXCLUSIVE') {
      vatAmount = roundMoney(taxableGross * normalizedRate)
      netSales = taxableGross
      grandTotal = roundMoney(taxableGross + vatAmount)
    } else {
      vatAmount = roundMoney(taxableGross * (normalizedRate / (1 + normalizedRate)))
      netSales = roundMoney(taxableGross - vatAmount)
      grandTotal = taxableGross
    }
  }

  return {
    grossSales,
    discountRate: normalizedDiscountRate,
    discountAmount,
    vatRate: normalizedRate,
    priceVatMode: mode,
    vatAmount,
    netSales,
    grandTotal,
    itemQtyTotal: lines.reduce((sum, line) => sum + line.qty, 0),
  }
}

export function roundMoney(value: number) {
  return Math.round(Number(value) * 100) / 100
}

/** `1,234,567,890.12` — comma thousands, two decimals (no currency symbol). */
export function formatAmount(value: number) {
  const safe = Number.isFinite(Number(value)) ? roundMoney(Number(value)) : 0
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** `₱1,234,567,890.12` */
export function formatMoney(value: number) {
  return `₱${formatAmount(value)}`
}

/** `1,234,567` — comma thousands, no decimals. */
export function formatInteger(value: number) {
  const safe = Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0
  return safe.toLocaleString('en-US')
}

/** `12.34%` */
export function formatPercent(value: number, fractionDigits = 2) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0
  return `${safe.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`
}

/** Parses display/input values like `1,234.56` or `₱1,234.56`. */
export function parseMoneyInput(value: string) {
  const normalized = String(value).replace(/[₱,\s]/g, '').trim()
  if (!normalized) {
    return 0
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? roundMoney(parsed) : NaN
}
