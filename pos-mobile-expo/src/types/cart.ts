export type CartLine = {
  id: string
  barcode: string
  name: string
  category: string
  brand: string
  product_image_path?: string | null
  unit: string
  batch_id: string
  qty: number
  price: number
  total: number
}

export type CartTotals = {
  grossSales: number
  discountRate: number
  discountAmount: number
  vatRate: number
  vatAmount: number
  netSales: number
  grandTotal: number
  itemQtyTotal: number
}
