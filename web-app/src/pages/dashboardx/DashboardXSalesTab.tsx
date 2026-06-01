import { useMemo } from 'react'
import DashboardApexChart from '../../components/dashboard/DashboardApexChart'
import { useTheme } from '../../context/useTheme'
import type { DashboardSalesResponse } from '../../lib/dashboardXApi'
import {
  buildAreaTrendOptions,
  buildColumnOptions,
  buildDonutOptions,
  buildHorizontalBarOptions,
} from '../../lib/dashboardChartTheme'
import { formatDashboardDayLabel, formatDashboardDayRange, toInt, toMoney } from '../../lib/dashboardXUtils'

type DashboardXSalesTabProps = {
  data: DashboardSalesResponse
}

function DashboardXSalesTab({ data }: DashboardXSalesTabProps) {
  const { theme } = useTheme()
  const colors = theme.colors

  const dailySales = data.dailySalesLastMonth?.points ?? data.trends
  const dailyRangeLabel = useMemo(() => {
    const range = data.dailySalesLastMonth
    if (!range?.start_date || !range?.end_date) {
      return 'Last 30 days'
    }
    return formatDashboardDayRange(range.start_date, range.end_date)
  }, [data.dailySalesLastMonth])

  const trendCategories = useMemo(() => dailySales.map((row) => formatDashboardDayLabel(row.period)), [dailySales])
  const trendSeries = useMemo(
    () => [
      { name: 'Daily Sales', type: 'area' as const, data: dailySales.map((row) => Number(row.totalSales || 0)) },
      { name: 'Transactions', type: 'line' as const, data: dailySales.map((row) => Number(row.transactions || 0)) },
    ],
    [dailySales],
  )
  const trendOptions = useMemo(
    () => buildAreaTrendOptions(colors, trendCategories, { height: 280, enableZoom: true, dualAxis: true }),
    [colors, trendCategories],
  )

  const dailySummary = useMemo(() => {
    const totalSales = dailySales.reduce((sum, row) => sum + Number(row.totalSales || 0), 0)
    const totalTransactions = dailySales.reduce((sum, row) => sum + Number(row.transactions || 0), 0)
    const daysWithSales = dailySales.filter((row) => Number(row.totalSales || 0) > 0).length
    const avgDailySales = dailySales.length ? totalSales / dailySales.length : 0

    return { totalSales, totalTransactions, daysWithSales, avgDailySales }
  }, [dailySales])

  const topProductCategories = useMemo(
    () => data.topProducts.map((row) => row.productName),
    [data.topProducts],
  )
  const topProductSeries = useMemo(
    () => [{ name: 'Total Sales', data: data.topProducts.map((row) => Number(row.totalSales || 0)) }],
    [data.topProducts],
  )
  const topProductHeight = Math.max(360, Math.min(data.topProducts.length, 20) * 32)
  const topProductOptions = useMemo(
    () => buildHorizontalBarOptions(colors, topProductCategories, { height: topProductHeight, money: true }),
    [colors, topProductCategories, topProductHeight],
  )

  const categoryLabels = useMemo(() => data.salesByCategory.map((row) => row.category), [data.salesByCategory])
  const categorySeries = useMemo(
    () => data.salesByCategory.map((row) => Number(row.totalSales || 0)),
    [data.salesByCategory],
  )
  const categoryOptions = useMemo(
    () => buildDonutOptions(colors, categoryLabels, { height: 280 }),
    [colors, categoryLabels],
  )

  const peakCategories = useMemo(() => data.peakHours.map((row) => String(row.hour)), [data.peakHours])
  const peakSeries = useMemo(
    () => [{ name: 'Transactions', data: data.peakHours.map((row) => Number(row.transactions || 0)) }],
    [data.peakHours],
  )
  const peakOptions = useMemo(
    () => buildColumnOptions(colors, peakCategories, { height: 260 }),
    [colors, peakCategories],
  )

  return (
    <article className="surface-card surface-card--wide">
      <div className="panel-header">
        <div>
          <h2>Sales & Revenue</h2>
          <p>Daily/weekly/monthly trends, top products, category mix, peak hours, and discounts/voids.</p>
        </div>
      </div>

      <div className="dashboardx-grid">
        <div className="dashboardx-chart-card dashboardx-chart-card--wide">
          <h3>Daily Sales Summary (Last 30 Days)</h3>
          <p className="dashboardx-chart-subtitle">{dailyRangeLabel} · excludes voided transactions</p>
          <div className="dashboardx-kpi-row dashboardx-kpi-row--inline">
            <div className="dashboardx-kpi-card">
              <span>Period Total</span>
              <strong>{toMoney(dailySummary.totalSales)}</strong>
            </div>
            <div className="dashboardx-kpi-card">
              <span>Avg / Day</span>
              <strong>{toMoney(dailySummary.avgDailySales)}</strong>
            </div>
            <div className="dashboardx-kpi-card">
              <span>Transactions</span>
              <strong>{toInt(dailySummary.totalTransactions)}</strong>
            </div>
            <div className="dashboardx-kpi-card">
              <span>Days With Sales</span>
              <strong>{toInt(dailySummary.daysWithSales)}</strong>
            </div>
          </div>
          <DashboardApexChart
            type="area"
            series={trendSeries}
            options={trendOptions}
            height={300}
            isEmpty={dailySales.length === 0}
            emptyMessage="No sales recorded in the last 30 days."
          />
        </div>

        <div className="dashboardx-chart-card dashboardx-chart-card--donut">
          <h3>Sales by Category</h3>
          <DashboardApexChart
            type="donut"
            series={categorySeries}
            options={categoryOptions}
            height={280}
            isEmpty={categorySeries.length === 0 || categorySeries.every((v) => v === 0)}
            emptyMessage="No category sales for the selected range."
          />
        </div>

        <div className="dashboardx-chart-card dashboardx-chart-card--wide">
          <h3>Top 100 Top-Selling Products</h3>
          <div className="dashboardx-scroll-chart">
            <DashboardApexChart
              type="bar"
              series={topProductSeries}
              options={topProductOptions}
              height={topProductHeight}
              isEmpty={data.topProducts.length === 0}
            />
          </div>
        </div>

        <div className="dashboardx-chart-card">
          <h3>Peak Hours</h3>
          <DashboardApexChart
            type="bar"
            series={peakSeries}
            options={peakOptions}
            height={260}
            isEmpty={data.peakHours.length === 0}
          />
        </div>
      </div>

      <div className="dashboardx-kpi-row">
        <div className="dashboardx-kpi-card">
          <span>Discounts Total</span>
          <strong>{toMoney(data.discountsAndVoids.discountsTotal)}</strong>
        </div>
        <div className="dashboardx-kpi-card">
          <span>Discounted Transactions</span>
          <strong>{toInt(data.discountsAndVoids.discountedTransactions)}</strong>
        </div>
        <div className="dashboardx-kpi-card">
          <span>Voided Transactions</span>
          <strong>{toInt(data.discountsAndVoids.voidedTransactions)}</strong>
        </div>
        <div className="dashboardx-kpi-card">
          <span>Voided Amount</span>
          <strong>{toMoney(data.discountsAndVoids.voidedAmount)}</strong>
        </div>
      </div>
    </article>
  )
}

export default DashboardXSalesTab
