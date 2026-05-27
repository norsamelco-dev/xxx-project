import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { CartLine, CartTotals } from '../types/cart'
import { computeCartTotals } from '../utils/vat'
import { useAuth } from './AuthContext'
import { clearCart, removeCartLine, upsertCartLine } from '../services/api/posApi'

type CartContextValue = {
  lines: CartLine[]
  pendingQty: number
  discountRate: number
  totals: CartTotals
  setPendingQty: (qty: number) => void
  setDiscountRate: (rate: number) => void
  addLine: (line: Omit<CartLine, 'id' | 'total'> & { qty?: number }) => void
  updateLineQty: (id: string, qty: number) => void
  removeLine: (id: string) => void
  emptyCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function CartProvider({ children, vatRate = 0.12 }: { children: ReactNode; vatRate?: number }) {
  const { user } = useAuth()
  const [lines, setLines] = useState<CartLine[]>([])
  const [pendingQty, setPendingQty] = useState(1)
  const [discountRate, setDiscountRate] = useState(0)

  const totals = useMemo(() => computeCartTotals(lines, discountRate, vatRate), [lines, discountRate, vatRate])

  const addLine = useCallback(
    (input: Omit<CartLine, 'id' | 'total'> & { qty?: number }) => {
      const qty = Math.max(1, input.qty ?? pendingQty)
      const price = input.price
      const total = Math.round(price * qty * 100) / 100

      setLines((current) => {
        const existing = current.find((line) => line.barcode === input.barcode && line.batch_id === input.batch_id)

        if (existing) {
          if (user) {
            const nextQty = existing.qty + qty
            const nextTotal = Math.round(existing.price * nextQty * 100) / 100
            void upsertCartLine({
              barcode: input.barcode,
              batch_id: input.batch_id,
              description: input.name,
              brand: input.brand,
              unit: input.unit,
              qty: nextQty,
              price: existing.price,
              total: nextTotal,
            }).catch(() => undefined)
          }

          return current.map((line) =>
            line.id === existing.id
              ? {
                  ...line,
                  qty: line.qty + qty,
                  total: Math.round(line.price * (line.qty + qty) * 100) / 100,
                }
              : line,
          )
        }

        if (user) {
          void upsertCartLine({
            barcode: input.barcode,
            batch_id: input.batch_id,
            description: input.name,
            brand: input.brand,
            unit: input.unit,
            qty,
            price,
            total,
          }).catch(() => undefined)
        }

        return [
          ...current,
          {
            ...input,
            id: makeId(),
            qty,
            total,
          },
        ]
      })

      setPendingQty(1)
    },
    [pendingQty, user],
  )

  const updateLineQty = useCallback((id: string, qty: number) => {
    const nextQty = Math.max(1, qty)
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              qty: nextQty,
              total: Math.round(line.price * nextQty * 100) / 100,
            }
          : line,
      ),
    )

    if (user) {
      const existing = lines.find((line) => line.id === id)
      if (existing) {
        const nextTotal = Math.round(existing.price * nextQty * 100) / 100

        void upsertCartLine({
          barcode: existing.barcode,
          batch_id: existing.batch_id,
          description: existing.name,
          brand: existing.brand,
          unit: existing.unit,
          qty: nextQty,
          price: existing.price,
          total: nextTotal,
        }).catch(() => undefined)
      }
    }
  }, [lines, user])

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
      removeLine,
      emptyCart,
    }),
    [lines, pendingQty, discountRate, totals, addLine, updateLineQty, removeLine, emptyCart],
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
