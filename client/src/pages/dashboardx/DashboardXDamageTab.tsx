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
import type { DashboardDamageReportsResponse } from '../../lib/dashboardXApi'
import { toInt } from '../../lib/dashboardXUtils'

type DashboardXDamageTabProps = {
  data: DashboardDamageReportsResponse
}

function DashboardXDamageTab({ data }: DashboardXDamageTabProps) {
  const { summary, topReasons, topProducts, syncTrendSnapshot, notes } = data

  return (
    <>
      <div className="dashboardx-damage-summary-grid">
        <article className="dashboardx-inventory-card dashboardx-inventory-card--neutral">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📝</div>
          <div>
            <span className="dashboardx-inventory-card__label">Open Draft Reports</span>
            <strong>{toInt(summary.draftReportsOpen)}</strong>
          </div>
        </article>
        <article className="dashboardx-inventory-card dashboardx-inventory-card--info">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📋</div>
          <div>
            <span className="dashboardx-inventory-card__label">Reports Created</span>
            <strong>{toInt(summary.reportsCreatedInRange)}</strong>
          </div>
        </article>
        <article className="dashboardx-inventory-card dashboardx-inventory-card--good">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">✅</div>
          <div>
            <span className="dashboardx-inventory-card__label">Reports Synced</span>
            <strong>{toInt(summary.reportsSyncedInRange)}</strong>
          </div>
        </article>
        <article className="dashboardx-inventory-card dashboardx-inventory-card--outflow">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📦</div>
          <div>
            <span className="dashboardx-inventory-card__label">Qty Damaged (Synced)</span>
            <strong>{toInt(summary.totalQtyDamaged)}</strong>
          </div>
        </article>
        <article className="dashboardx-inventory-card dashboardx-inventory-card--warning">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">🔄</div>
          <div>
            <span className="dashboardx-inventory-card__label">Sync Logs</span>
            <strong>{toInt(summary.syncLogsTotal)}</strong>
          </div>
        </article>
        <article className="dashboardx-inventory-card dashboardx-inventory-card--critical">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">⛔</div>
          <div>
            <span className="dashboardx-inventory-card__label">Failed Syncs</span>
            <strong>{toInt(summary.syncLogsFailed)}</strong>
          </div>
        </article>
      </div>

      <div className="dashboardx-damage-actions">
        <Link to="/damage-reports" className="button-secondary">
          <ButtonLabel icon="open">Open Damage Reports</ButtonLabel>
        </Link>
        <Link to="/damage-reports?tab=sync-logs" className="button-secondary">
          <ButtonLabel icon="sync">View Sync Logs</ButtonLabel>
        </Link>
      </div>

      <div className="dashboardx-grid">
        <div className="dashboardx-chart-card">
          <h3>Sync Activity</h3>
          {syncTrendSnapshot.length === 0 ? (
            <div className="empty-state">No sync activity for the selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={syncTrendSnapshot}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="syncCount" stroke="#0ea5e9" strokeWidth={2} name="Sync Runs" />
                <Line type="monotone" dataKey="failedCount" stroke="#ef4444" strokeWidth={2} name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dashboardx-chart-card">
          <h3>Top Damage Reasons</h3>
          {topReasons.length === 0 ? (
            <div className="empty-state">No synced damage reasons in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topReasons}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="reasonLabel" interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="totalQty" fill="#f97316" name="Qty Damaged" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dashboardx-chart-card dashboardx-chart-card--wide">
          <h3>Top Damaged Products (Sync Deductions)</h3>
          {topProducts.length === 0 ? (
            <div className="empty-state">No product deductions logged for this period.</div>
          ) : (
            <div className="dashboardx-scroll-chart">
              <ResponsiveContainer width="100%" height={Math.max(280, topProducts.length * 32)}>
                <BarChart data={topProducts} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="productName" width={220} interval={0} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="qtyDeducted" fill="#8b5cf6" name="Qty Deducted" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {notes[0] ? <p className="dashboardx-note">{notes.join(' ')}</p> : null}
    </>
  )
}

export default DashboardXDamageTab
