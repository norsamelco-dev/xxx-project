import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLabel } from '../../components/ButtonIcon'
import DashboardApexChart from '../../components/dashboard/DashboardApexChart'
import { useTheme } from '../../context/useTheme'
import type { DashboardOverviewResponse } from '../../lib/dashboardXApi'
import {
  buildAreaTrendOptions,
  buildHorizontalBarOptions,
} from '../../lib/dashboardChartTheme'
import { formatDashboardDayLabel, formatDashboardDayRange, toInt, toMoney } from '../../lib/dashboardXUtils'

type DashboardXOverviewTabProps = {
  data: DashboardOverviewResponse
}

function DashboardXOverviewTab({ data }: DashboardXOverviewTabProps) {
  const { theme } = useTheme()
  const colors = theme.colors
  const { overview, alerts } = data
  const dailySales = data.dailySalesLastMonth?.points ?? data.salesTrendSnapshot
  const dailyRangeLabel = data.dailySalesLastMonth?.start_date && data.dailySalesLastMonth?.end_date
    ? formatDashboardDayRange(data.dailySalesLastMonth.start_date, data.dailySalesLastMonth.end_date)
    : 'Last 30 days'
  const damageReports = data.damageReports || {
    draftReportsOpen: 0,
    reportsCreatedInRange: 0,
    reportsSyncedInRange: 0,
    totalQtyDamaged: 0,
    totalLineItems: 0,
    syncLogsTotal: 0,
    syncLogsSuccess: 0,
    syncLogsFailed: 0,
  }
  const topDamageReasons = data.topDamageReasons || []

  const trendCategories = useMemo(
    () => dailySales.map((row) => formatDashboardDayLabel(row.period)),
    [dailySales],
  )

  const trendSeries = useMemo(
    () => [
      { name: 'Daily Sales', type: 'area' as const, data: dailySales.map((row) => Number(row.totalSales || 0)) },
      { name: 'Transactions', type: 'line' as const, data: dailySales.map((row) => Number(row.transactions || 0)) },
    ],
    [dailySales],
  )

  const trendOptions = useMemo(
    () => buildAreaTrendOptions(colors, trendCategories, { height: 280, dualAxis: true }),
    [colors, trendCategories],
  )

  const damageReasonCategories = useMemo(
    () => topDamageReasons.map((row) => row.reasonLabel),
    [topDamageReasons],
  )

  const damageReasonSeries = useMemo(
    () => [{ name: 'Qty Damaged', data: topDamageReasons.map((row) => Number(row.totalQty || 0)) }],
    [topDamageReasons],
  )

  const damageReasonOptions = useMemo(
    () => buildHorizontalBarOptions(colors, damageReasonCategories, { height: Math.max(220, topDamageReasons.length * 36), dataLabels: true }),
    [colors, damageReasonCategories, topDamageReasons.length],
  )

  return (
    <>
      <div className="summary-grid">
        <article className="summary-card">
          <div>
            <span className="summary-label">Total Sales Today</span>
            <strong>{toMoney(overview.totalSalesToday)}</strong>
          </div>
        </article>
        <article className="summary-card">
          <div>
            <span className="summary-label">Total Sales This Week</span>
            <strong>{toMoney(overview.totalSalesWeek)}</strong>
          </div>
        </article>
        <article className="summary-card">
          <div>
            <span className="summary-label">Total Sales This Month</span>
            <strong>{toMoney(overview.totalSalesMonth)}</strong>
          </div>
        </article>
        <article className="summary-card">
          <div>
            <span className="summary-label">Total Transactions</span>
            <strong>{toInt(overview.totalTransactions)}</strong>
          </div>
        </article>
        <article className="summary-card">
          <div>
            <span className="summary-label">Active Machines</span>
            <strong>{toInt(overview.activeMachines)}</strong>
          </div>
        </article>
        <article className="summary-card">
          <div>
            <span className="summary-label">Active Users</span>
            <strong>{toInt(overview.activeUsers)}</strong>
          </div>
        </article>
      </div>

      <div className="dashboardx-alert-row">
        <article className="dashboardx-inventory-card dashboardx-inventory-card--warning dashboardx-alert-chip">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">⚠️</div>
          <div>
            <span className="dashboardx-inventory-card__label">Low Stock</span>
            <strong>{toInt(alerts.lowStockAlerts)}</strong>
          </div>
        </article>
        <article className="dashboardx-inventory-card dashboardx-inventory-card--critical dashboardx-alert-chip">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">⛔</div>
          <div>
            <span className="dashboardx-inventory-card__label">Out of Stock</span>
            <strong>{toInt(alerts.outOfStockItems)}</strong>
          </div>
        </article>
        <article className="dashboardx-inventory-card dashboardx-inventory-card--attention dashboardx-alert-chip">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">⏳</div>
          <div>
            <span className="dashboardx-inventory-card__label">Near Expiry</span>
            <strong>{toInt(alerts.nearExpiryItems)}</strong>
          </div>
        </article>
      </div>

      <article className="surface-card surface-card--wide">
        <div className="panel-header">
          <div>
            <h2>Damage Reports</h2>
            <p>Synced damage activity for the selected filter range.</p>
          </div>
          <div className="audit-card-actions">
            <Link to="/dashboard-x?tab=damage" className="button-secondary button-secondary--compact">
              <ButtonLabel icon="details">View Damage Tab</ButtonLabel>
            </Link>
          </div>
        </div>

        <div className="dashboardx-damage-summary-grid dashboardx-damage-summary-grid--compact">
          <article className="dashboardx-inventory-card dashboardx-inventory-card--neutral dashboardx-alert-chip">
            <div className="dashboardx-inventory-card__icon" aria-hidden="true">📝</div>
            <div>
              <span className="dashboardx-inventory-card__label">Open Drafts</span>
              <strong>{toInt(damageReports.draftReportsOpen)}</strong>
            </div>
          </article>
          <article className="dashboardx-inventory-card dashboardx-inventory-card--good dashboardx-alert-chip">
            <div className="dashboardx-inventory-card__icon" aria-hidden="true">✅</div>
            <div>
              <span className="dashboardx-inventory-card__label">Synced</span>
              <strong>{toInt(damageReports.reportsSyncedInRange)}</strong>
            </div>
          </article>
          <article className="dashboardx-inventory-card dashboardx-inventory-card--outflow dashboardx-alert-chip">
            <div className="dashboardx-inventory-card__icon" aria-hidden="true">📦</div>
            <div>
              <span className="dashboardx-inventory-card__label">Qty Damaged</span>
              <strong>{toInt(damageReports.totalQtyDamaged)}</strong>
            </div>
          </article>
          <article className="dashboardx-inventory-card dashboardx-inventory-card--critical dashboardx-alert-chip">
            <div className="dashboardx-inventory-card__icon" aria-hidden="true">⛔</div>
            <div>
              <span className="dashboardx-inventory-card__label">Failed Syncs</span>
              <strong>{toInt(damageReports.syncLogsFailed)}</strong>
            </div>
          </article>
        </div>

        {topDamageReasons.length > 0 ? (
          <div className="dashboardx-chart-card dashboardx-chart-card--compact">
            <h3>Top Damage Reasons</h3>
            <DashboardApexChart
              type="bar"
              series={damageReasonSeries}
              options={damageReasonOptions}
              height={Math.max(220, topDamageReasons.length * 36)}
              isEmpty={topDamageReasons.length === 0}
              emptyMessage="No damage reasons in this period."
            />
          </div>
        ) : null}
      </article>

      <article className="surface-card surface-card--wide">
        <div className="panel-header">
          <div>
            <h2>Daily Sales Summary</h2>
            <p>Daily totals for the last 30 days ({dailyRangeLabel}). Other filters do not affect this chart.</p>
          </div>
        </div>
        <div className="dashboardx-chart-card">
          <DashboardApexChart
            type="area"
            series={trendSeries}
            options={trendOptions}
            height={280}
            isEmpty={dailySales.length === 0}
            emptyMessage="No sales recorded in the last 30 days."
          />
        </div>
      </article>
    </>
  )
}

export default DashboardXOverviewTab
