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

export function formatMoney(value: number) {
  return `₱${roundMoney(value).toFixed(2)}`
}
