import type { PosConfig } from './config'
import type { PosReport } from './pos'
import { roundMoney } from '../utils/vat'

export const PHP_BILL_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1] as const

export type CashDenominationEntry = {
  value: number
  qty: number
}

export type CashCountSheetPrintInput = {
  config: PosConfig
  report: PosReport
  activeSeriesNo: string | null
  cashierName: string
  denominations: CashDenominationEntry[]
  coinsOther: number
  printedAt?: Date
}

export function createEmptyDenominationEntries(): CashDenominationEntry[] {
  return PHP_BILL_DENOMINATIONS.map((value) => ({ value, qty: 0 }))
}

export function computePhysicalCashTotal(denominations: CashDenominationEntry[], coinsOther: number) {
  const bills = denominations.reduce((sum, row) => sum + row.value * Math.max(0, row.qty), 0)
  return roundMoney(bills + Math.max(0, coinsOther))
}

export function computeCashVariance(physicalTotal: number, systemTotal: number) {
  return roundMoney(physicalTotal - systemTotal)
}

export function formatVarianceLabel(variance: number) {
  if (Math.abs(variance) < 0.005) {
    return 'BALANCED'
  }
  if (variance > 0) {
    return 'OVER'
  }
  return 'SHORT'
}
