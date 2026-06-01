import { useMemo } from 'react'
import DashboardApexChart from '../../components/dashboard/DashboardApexChart'
import { useTheme } from '../../context/useTheme'
import type { DashboardFinancialResponse } from '../../lib/dashboardXApi'
import { buildDonutOptions } from '../../lib/dashboardChartTheme'
import { toInt, toMoney } from '../../lib/dashboardXUtils'

type DashboardXFinancialTabProps = {
  data: DashboardFinancialResponse
}

function DashboardXFinancialTab({ data }: DashboardXFinancialTabProps) {
  const { theme } = useTheme()
  const colors = theme.colors
  const { financial } = data

  const paymentLabels = useMemo(() => ['Cash', 'Non-Cash'], [])
  const paymentSeries = useMemo(
    () => [
      Number(financial.cashVsNonCash.cash || 0),
      Number(financial.cashVsNonCash.nonCash || 0),
    ],
    [financial.cashVsNonCash.cash, financial.cashVsNonCash.nonCash],
  )

  const paymentOptions = useMemo(
    () => buildDonutOptions(colors, paymentLabels, { height: 280 }),
    [colors, paymentLabels],
  )

  const paymentTotal = paymentSeries.reduce((sum, value) => sum + value, 0)

  return (
    <article className="surface-card surface-card--wide">
      <div className="panel-header">
        <div>
          <h2>Financial Summary</h2>
          <p>Cash vs non-cash, refunds/returns, net profit estimate, and tax collected.</p>
        </div>
      </div>

      <div className="dashboardx-grid">
        <div className="dashboardx-chart-card dashboardx-chart-card--donut">
          <h3>Payment Mix</h3>
          <DashboardApexChart
            type="donut"
            series={paymentSeries}
            options={paymentOptions}
            height={280}
            isEmpty={paymentTotal <= 0}
            emptyMessage="No payment data for the selected range."
          />
        </div>

        <div className="dashboardx-kpi-row dashboardx-kpi-row--stacked">
          <div className="dashboardx-kpi-card">
            <span>Gross Sales</span>
            <strong>{toMoney(financial.netProfit.grossSales)}</strong>
          </div>
          <div className="dashboardx-kpi-card">
            <span>Estimated COGS</span>
            <strong>{toMoney(financial.netProfit.estimatedCogs)}</strong>
          </div>
          <div className="dashboardx-kpi-card">
            <span>Estimated Net Profit</span>
            <strong>{toMoney(financial.netProfit.estimatedNetProfit)}</strong>
          </div>
          <div className="dashboardx-kpi-card">
            <span>Tax Collected</span>
            <strong>{toMoney(financial.taxCollected)}</strong>
          </div>
          <div className="dashboardx-kpi-card">
            <span>Refunds / Returns (Est.)</span>
            <strong>{toMoney(financial.refundsAndReturns.estimatedAmount)}</strong>
          </div>
          <div className="dashboardx-kpi-card">
            <span>Refunded / Voided Txns</span>
            <strong>{toInt(financial.refundsAndReturns.estimatedTransactions)}</strong>
          </div>
        </div>
      </div>

      <p className="dashboardx-note">{financial.netProfit.note}</p>
    </article>
  )
}

export default DashboardXFinancialTab
