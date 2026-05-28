import type { CartLine, CartTotals } from '../types/cart'
import type { CheckoutLine, CheckoutResult } from '../types/pos'

export function mapCheckoutLinesToCartLines(lines: CheckoutLine[]): CartLine[] {
  return lines.map((line, index) => ({
    id: `sale-${index}`,
    barcode: line.barcode,
    name: line.description,
    category: line.category,
    brand: line.brand,
    unit: line.unit,
    batch_id: line.batch_id,
    qty: line.qty,
    price: line.price,
    total: line.total,
  }))
}

export function mapCheckoutTotalsToCartTotals(totals: CheckoutResult['totals']): CartTotals {
  return {
    grossSales: totals.grossSales,
    discountRate: totals.discountRate,
    discountAmount: totals.discountAmount,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    netSales: totals.netSales,
    grandTotal: totals.grandTotal,
    itemQtyTotal: totals.itemQtyTotal,
  }
}
