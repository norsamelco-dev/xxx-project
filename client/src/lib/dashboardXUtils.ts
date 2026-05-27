export type DashboardGroupBy = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function toCurrentYearNumber() {
  return new Date().getFullYear()
}

export function toMonthDateRange(year: number, month: number | 'all') {
  const safeYear = Number.isInteger(year) ? year : toCurrentYearNumber()

  if (month === 'all') {
    return {
      startDate: `${safeYear}-01-01`,
      endDate: `${safeYear}-12-31`,
    }
  }

  const safeMonth = Math.min(Math.max(month, 1), 12)
  const start = new Date(safeYear, safeMonth - 1, 1)
  const end = new Date(safeYear, safeMonth, 0)

  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`

  return { startDate, endDate }
}

export function parseMonthFromRange(startValue: string | null | undefined, endValue: string | null | undefined) {
  const start = new Date(String(startValue || ''))
  const end = new Date(String(endValue || ''))

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'all' as const
  }

  const sameYear = start.getFullYear() === end.getFullYear()
  const isFullYear = start.getMonth() === 0
    && start.getDate() === 1
    && end.getMonth() === 11
    && end.getDate() === 31

  if (sameYear && isFullYear) {
    return 'all' as const
  }

  return start.getMonth() + 1
}

export function parseYearFromDate(value: string | null | undefined) {
  const date = new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) {
    return toCurrentYearNumber()
  }

  return date.getFullYear()
}

export function toMoney(value: number | null | undefined) {
  const amount = Number(value || 0)
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function toInt(value: number | null | undefined) {
  const amount = Number(value || 0)
  return amount.toLocaleString()
}

export function formatTooltipMoney(value: unknown) {
  return toMoney(Number(value || 0))
}

export function buildFilterCacheKey(
  tab: string,
  startDate: string,
  endDate: string,
  groupBy: DashboardGroupBy,
) {
  return `${tab}:${startDate}:${endDate}:${groupBy}`
}
