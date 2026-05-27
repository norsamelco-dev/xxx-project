import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ButtonLabel } from '../../components/ButtonIcon'
import type { DashboardOverviewResponse } from '../../lib/dashboardXApi'
import { formatTooltipMoney, toInt, toMoney } from '../../lib/dashboardXUtils'

type DashboardXOverviewTabProps = {
  data: DashboardOverviewResponse
}

function DashboardXOverviewTab({ data }: DashboardXOverviewTabProps) {
  const { overview, alerts, salesTrendSnapshot } = data
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
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topDamageReasons}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="reasonLabel" interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="totalQty" fill="#f97316" name="Qty Damaged" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </article>

      <article className="surface-card surface-card--wide">
        <div className="panel-header">
          <div>
            <h2>Sales Trend Snapshot</h2>
            <p>Recent sales activity for the selected filter range (up to 14 periods).</p>
          </div>
        </div>
        <div className="dashboardx-chart-card">
          {salesTrendSnapshot.length === 0 ? (
            <div className="empty-state">No sales trend data for the selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={salesTrendSnapshot}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value) => formatTooltipMoney(value)} />
                <Legend />
                <Line type="monotone" dataKey="totalSales" stroke="#0ea5e9" strokeWidth={2} name="Total Sales" />
                <Line type="monotone" dataKey="transactions" stroke="#f97316" strokeWidth={2} name="Transactions" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>
    </>
  )
}

export default DashboardXOverviewTab
