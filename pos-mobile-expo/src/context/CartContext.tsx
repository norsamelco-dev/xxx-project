import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartLine, CartTotals } from '../types/cart'
import type { PriceVatMode } from '../utils/vat'
import { computeCartTotals } from '../utils/vat'
import { useAuth } from './AuthContext'
import { addToCartFifo, clearCart, getCartLines, removeCartLine, upsertCartLine } from '../services/api/posApi'

type CartContextValue = {
  lines: CartLine[]
  pendingQty: number
  discountRate: number
  totals: CartTotals
  setPendingQty: (qty: number) => void
  setDiscountRate: (rate: number) => void
  addLine: (line: Omit<CartLine, 'id' | 'total'> & { qty?: number }) => Promise<void>
  updateLineQty: (id: string, qty: number) => Promise<void>
  incrementLineQty: (id: string) => Promise<void>
  decrementLineQty: (id: string) => Promise<void>
  removeLine: (id: string) => void
  emptyCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cartLineKey(line: Pick<CartLine, 'barcode' | 'batch_id'>) {
  return `${line.barcode}::${line.batch_id}`
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function mergeCartLines(lines: CartLine[]): CartLine[] {
  const merged = new Map<string, CartLine>()

  for (const line of lines) {
    const key = cartLineKey(line)
    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, { ...line })
      continue
    }

    const qty = existing.qty + line.qty
    merged.set(key, {
      ...existing,
      qty,
      total: roundMoney(existing.price * qty),
      product_image_path: existing.product_image_path ?? line.product_image_path ?? null,
    })
  }

  return Array.from(merged.values())
}

function mapServerCartLine(
  row: {
    id: number
    barcode: string
    batch_id: string
    description: string
    brand: string
    unit: string
    qty: number
    price: number
    total: number
    product_image_path?: string | null
  },
  fallback?: Partial<CartLine>,
): CartLine {
  return {
    id: String(row.id),
    barcode: row.barcode,
    name: row.description || row.barcode,
    category: fallback?.category || '',
    brand: row.brand || fallback?.brand || '',
    product_image_path: row.product_image_path ?? fallback?.product_image_path ?? null,
    unit: row.unit || fallback?.unit || '',
    batch_id: row.batch_id,
    qty: Number(row.qty) || 0,
    price: Number(row.price) || 0,
    total: Number(row.total) || 0,
  }
}

function upsertLocalCartLine(current: CartLine[], incoming: CartLine): CartLine[] {
  const withoutMatch = current.filter((line) => cartLineKey(line) !== cartLineKey(incoming))
  const existing = current.find((line) => cartLineKey(line) === cartLineKey(incoming))

  return [
    ...withoutMatch,
    {
      ...incoming,
      id: existing?.id || incoming.id,
      category: incoming.category || existing?.category || '',
      product_image_path: incoming.product_image_path ?? existing?.product_image_path ?? null,
    },
  ]
}

function applyFifoLinesToCart(
  current: CartLine[],
  serverLines: Array<{
    id: number
    batch_id: string
    barcode: string
    description: string
    brand: string
    unit: string
    qty: number
    price: number
    total: number
    product_image_path?: string | null
  }>,
  fallback?: Partial<CartLine>,
): CartLine[] {
  let next = [...current]

  for (const serverLine of serverLines) {
    const mapped = mapServerCartLine(
      {
        ...serverLine,
        product_image_path: serverLine.product_image_path ?? fallback?.product_image_path ?? null,
      },
      fallback,
    )
    mapped.name = serverLine.description
    next = upsertLocalCartLine(next, mapped)
  }

  return mergeCartLines(next)
}

export function CartProvider({
  children,
  vatRate = 0.12,
  priceVatMode = 'INCLUSIVE',
}: {
  children: ReactNode
  vatRate?: number
  priceVatMode?: PriceVatMode
}) {
  const { user } = useAuth()
  const [lines, setLines] = useState<CartLine[]>([])
  const [pendingQty, setPendingQty] = useState(1)
  const [discountRate, setDiscountRate] = useState(0)

  const totals = useMemo(
    () => computeCartTotals(lines, discountRate, vatRate, priceVatMode),
    [lines, discountRate, vatRate, priceVatMode],
  )

  useEffect(() => {
    if (!user) {
      setLines([])
      setDiscountRate(0)
      setPendingQty(1)
      return
    }

    let isActive = true
    void getCartLines()
      .then((rows) => {
        if (!isActive) {
          return
        }
        setLines(mergeCartLines(rows.map((row) => mapServerCartLine(row))))
      })
      .catch(() => undefined)

    return () => {
      isActive = false
    }
  }, [user])

  const addLine = useCallback(
    async (input: Omit<CartLine, 'id' | 'total'> & { qty?: number }) => {
      const qty = Math.max(1, input.qty ?? pendingQty)
      const price = input.price

      if (user) {
        const result = await addToCartFifo({ barcode: input.barcode, qty })
        setLines((current) =>
          applyFifoLinesToCart(current, result.lines.map((line) => ({
            ...line,
            product_image_path: result.product_image_path ?? input.product_image_path ?? null,
          })), {
            category: input.category,
            brand: input.brand,
            unit: input.unit,
            product_image_path: input.product_image_path ?? null,
          }),
        )
        setPendingQty(1)
        return
      }

      setLines((current) => {
        const existing = current.find((line) => cartLineKey(line) === cartLineKey(input))

        if (existing) {
          const nextQty = existing.qty + qty
          return upsertLocalCartLine(current, {
            ...existing,
            qty: nextQty,
            total: roundMoney(existing.price * nextQty),
          })
        }

        return [
          ...current,
          {
            ...input,
            id: makeId(),
            qty,
            total: roundMoney(price * qty),
          },
        ]
      })

      setPendingQty(1)
    },
    [pendingQty, user],
  )

  const updateLineQty = useCallback(async (id: string, qty: number) => {
    const nextQty = Math.max(1, qty)

    const existing = lines.find((line) => line.id === id)
    if (!existing) {
      return
    }

    const previousQty = existing.qty
    const previousTotal = existing.total
    const nextTotal = Math.round(existing.price * nextQty * 100) / 100

    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              qty: nextQty,
              total: nextTotal,
            }
          : line,
      ),
    )

    if (user) {
      try {
        await upsertCartLine({
          barcode: existing.barcode,
          batch_id: existing.batch_id,
          description: existing.name,
          brand: existing.brand,
          unit: existing.unit,
          qty: nextQty,
          price: existing.price,
          total: nextTotal,
        })
      } catch (error) {
        setLines((current) =>
          current.map((line) =>
            line.id === id
              ? {
                  ...line,
                  qty: previousQty,
                  total: previousTotal,
                }
              : line,
          ),
        )
        throw error
      }
    }
  }, [lines, user])

  const incrementLineQty = useCallback(async (id: string) => {
    const existing = lines.find((line) => line.id === id)
    if (!existing) {
      return
    }

    if (user) {
      const result = await addToCartFifo({ barcode: existing.barcode, qty: 1 })
      setLines((current) =>
        applyFifoLinesToCart(current, result.lines.map((line) => ({
          ...line,
          product_image_path: result.product_image_path ?? existing.product_image_path ?? null,
        })), {
          category: existing.category,
          brand: existing.brand,
          unit: existing.unit,
          product_image_path: existing.product_image_path ?? null,
        }),
      )
      return
    }

    await updateLineQty(id, existing.qty + 1)
  }, [lines, user, updateLineQty])

  const decrementLineQty = useCallback(async (id: string) => {
    const existing = lines.find((line) => line.id === id)
    if (!existing) {
      return
    }
    await updateLineQty(id, Math.max(1, existing.qty - 1))
  }, [lines, updateLineQty])

  const removeLine = useCallback((id: string) => {
    setLines((current) => {
      const target = current.find((line) => line.id === id)

      if (target && user) {
        void removeCartLine({ barcode: target.barcode, batch_id: target.batch_id }).catch(() => undefined)
      }

      return current.filter((line) => line.id !== id)
    })
  }, [user])

  const emptyCart = useCallback(() => {
    if (user) {
      void clearCart().catch(() => undefined)
    }
    setLines([])
    setDiscountRate(0)
    setPendingQty(1)
  }, [user])

  const value = useMemo(
    () => ({
      lines,
      pendingQty,
      discountRate,
      totals,
      setPendingQty,
      setDiscountRate,
      addLine,
      updateLineQty,
      incrementLineQty,
      decrementLineQty,
      removeLine,
      emptyCart,
    }),
    [lines, pendingQty, discountRate, totals, addLine, updateLineQty, incrementLineQty, decrementLineQty, removeLine, emptyCart],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }

  return context
}
