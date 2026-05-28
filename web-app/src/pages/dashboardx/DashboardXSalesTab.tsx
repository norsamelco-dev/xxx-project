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
import type { DashboardSalesResponse } from '../../lib/dashboardXApi'
import { formatTooltipMoney, toInt, toMoney } from '../../lib/dashboardXUtils'

type DashboardXSalesTabProps = {
  data: DashboardSalesResponse
}

function DashboardXSalesTab({ data }: DashboardXSalesTabProps) {
  return (
    <article className="surface-card surface-card--wide">
      <div className="panel-header">
        <div>
          <h2>Sales & Revenue</h2>
          <p>Daily/weekly/monthly trends, top products, category mix, peak hours, and discounts/voids.</p>
        </div>
      </div>

      <div className="dashboardx-grid">
        <div className="dashboardx-chart-card">
          <h3>Sales Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => formatTooltipMoney(value)} />
              <Legend />
              <Line type="monotone" dataKey="totalSales" stroke="#0ea5e9" strokeWidth={2} name="Total Sales" />
              <Line type="monotone" dataKey="transactions" stroke="#f97316" strokeWidth={2} name="Transactions" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboardx-chart-card">
          <h3>Top 100 Top-Selling Products</h3>
          <div className="dashboardx-scroll-chart">
            <ResponsiveContainer width="100%" height={Math.max(360, data.topProducts.length * 28)}>
              <BarChart data={data.topProducts} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="productName" width={220} interval={0} />
                <Tooltip formatter={(value) => formatTooltipMoney(value)} />
                <Legend />
                <Bar dataKey="totalSales" fill="#2563eb" name="Total Sales" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboardx-chart-card">
          <h3>Sales by Category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.salesByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value) => formatTooltipMoney(value)} />
              <Bar dataKey="totalSales" fill="#0ea5e9" name="Total Sales" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboardx-chart-card">
          <h3>Peak Hours</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="transactions" fill="#14b8a6" name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
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
