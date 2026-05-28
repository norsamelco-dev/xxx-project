import type { CartLine, CartTotals } from '../types/cart'

const DEFAULT_VAT_RATE = 0.12

export function computeCartTotals(lines: CartLine[], discountRate: number, vatRate = DEFAULT_VAT_RATE): CartTotals {
  const grossSales = roundMoney(lines.reduce((sum, line) => sum + line.total, 0))
  const normalizedDiscountRate = Math.max(0, discountRate)
  const discountAmount = roundMoney(grossSales * normalizedDiscountRate)
  const taxableGross = roundMoney(grossSales - discountAmount)
  const vatAmount = roundMoney(taxableGross * (vatRate / (1 + vatRate)))
  const netSales = roundMoney(taxableGross - vatAmount)
  const grandTotal = taxableGross
  const itemQtyTotal = lines.reduce((sum, line) => sum + line.qty, 0)

  return {
    grossSales,
    discountRate: normalizedDiscountRate,
    discountAmount,
    vatRate,
    vatAmount,
    netSales,
    grandTotal,
    itemQtyTotal,
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
