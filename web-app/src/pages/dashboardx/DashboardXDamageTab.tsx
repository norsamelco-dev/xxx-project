import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLabel } from '../../components/ButtonIcon'
import DashboardApexChart from '../../components/dashboard/DashboardApexChart'
import { useTheme } from '../../context/useTheme'
import type { DashboardDamageReportsResponse } from '../../lib/dashboardXApi'
import { buildHorizontalBarOptions, buildLineOptions } from '../../lib/dashboardChartTheme'
import { toInt } from '../../lib/dashboardXUtils'

type DashboardXDamageTabProps = {
  data: DashboardDamageReportsResponse
}

function DashboardXDamageTab({ data }: DashboardXDamageTabProps) {
  const { theme } = useTheme()
  const colors = theme.colors
  const { summary, topReasons, topProducts, syncTrendSnapshot, notes } = data

  const syncCategories = useMemo(
    () => syncTrendSnapshot.map((row) => row.period),
    [syncTrendSnapshot],
  )
  const syncSeries = useMemo(
    () => [
      { name: 'Sync Runs', data: syncTrendSnapshot.map((row) => Number(row.syncCount || 0)) },
      { name: 'Failed', data: syncTrendSnapshot.map((row) => Number(row.failedCount || 0)) },
    ],
    [syncTrendSnapshot],
  )
  const syncOptions = useMemo(
    () => buildLineOptions(colors, syncCategories, { height: 260 }),
    [colors, syncCategories],
  )

  const reasonCategories = useMemo(
    () => topReasons.map((row) => row.reasonLabel),
    [topReasons],
  )
  const reasonSeries = useMemo(
    () => [{ name: 'Qty Damaged', data: topReasons.map((row) => Number(row.totalQty || 0)) }],
    [topReasons],
  )
  const reasonOptions = useMemo(
    () => buildHorizontalBarOptions(colors, reasonCategories, { height: 260, dataLabels: true }),
    [colors, reasonCategories],
  )

  const productCategories = useMemo(
    () => topProducts.map((row) => row.productName),
    [topProducts],
  )
  const productSeries = useMemo(
    () => [{ name: 'Qty Deducted', data: topProducts.map((row) => Number(row.qtyDeducted || 0)) }],
    [topProducts],
  )
  const productChartHeight = Math.max(280, topProducts.length * 32)
  const productOptions = useMemo(
    () => buildHorizontalBarOptions(colors, productCategories, { height: productChartHeight, dataLabels: true }),
    [colors, productCategories, productChartHeight],
  )

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
          <DashboardApexChart
            type="line"
            series={syncSeries}
            options={syncOptions}
            height={260}
            isEmpty={syncTrendSnapshot.length === 0}
            emptyMessage="No sync activity for the selected range."
          />
        </div>

        <div className="dashboardx-chart-card">
          <h3>Top Damage Reasons</h3>
          <DashboardApexChart
            type="bar"
            series={reasonSeries}
            options={reasonOptions}
            height={260}
            isEmpty={topReasons.length === 0}
            emptyMessage="No synced damage reasons in this period."
          />
        </div>

        <div className="dashboardx-chart-card dashboardx-chart-card--wide">
          <h3>Top Damaged Products (Sync Deductions)</h3>
          {topProducts.length === 0 ? (
            <div className="empty-state">No product deductions logged for this period.</div>
          ) : (
            <div className="dashboardx-scroll-chart">
              <DashboardApexChart
                type="bar"
                series={productSeries}
                options={productOptions}
                height={productChartHeight}
                isEmpty={topProducts.length === 0}
              />
            </div>
          )}
        </div>
      </div>

      {notes[0] ? <p className="dashboardx-note">{notes.join(' ')}</p> : null}
    </>
  )
}

export default DashboardXDamageTab
