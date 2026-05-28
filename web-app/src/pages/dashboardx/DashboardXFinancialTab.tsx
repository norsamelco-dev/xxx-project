import { useMemo } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { DashboardFinancialResponse } from '../../lib/dashboardXApi'
import { formatTooltipMoney, toInt, toMoney } from '../../lib/dashboardXUtils'

const PIE_COLORS = ['#0ea5e9', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#14b8a6']

type DashboardXFinancialTabProps = {
  data: DashboardFinancialResponse
}

function DashboardXFinancialTab({ data }: DashboardXFinancialTabProps) {
  const { financial } = data

  const paymentPieData = useMemo(
    () => [
      { name: 'Cash', value: Number(financial.cashVsNonCash.cash || 0) },
      { name: 'Non-Cash', value: Number(financial.cashVsNonCash.nonCash || 0) },
    ],
    [financial.cashVsNonCash.cash, financial.cashVsNonCash.nonCash],
  )

  return (
    <article className="surface-card surface-card--wide">
      <div className="panel-header">
        <div>
          <h2>Financial Summary</h2>
          <p>Cash vs non-cash, refunds/returns, net profit estimate, and tax collected.</p>
        </div>
      </div>

      <div className="dashboardx-chart-card dashboardx-chart-card--compact">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={paymentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {paymentPieData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatTooltipMoney(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="meta-list meta-list--tight">
        <li>
          <strong>Refunds / Returns (Estimated)</strong>
          {toMoney(financial.refundsAndReturns.estimatedAmount)}
        </li>
        <li>
          <strong>Refunded / Voided Transactions</strong>
          {toInt(financial.refundsAndReturns.estimatedTransactions)}
        </li>
        <li>
          <strong>Gross Sales</strong>
          {toMoney(financial.netProfit.grossSales)}
        </li>
        <li>
          <strong>Estimated COGS</strong>
          {toMoney(financial.netProfit.estimatedCogs)}
        </li>
        <li>
          <strong>Estimated Net Profit</strong>
          {toMoney(financial.netProfit.estimatedNetProfit)}
        </li>
        <li>
          <strong>Tax Collected</strong>
          {toMoney(financial.taxCollected)}
        </li>
      </ul>
      <p className="dashboardx-note">{financial.netProfit.note}</p>
    </article>
  )
}

export default DashboardXFinancialTab
