import { useMemo } from 'react'
import DashboardApexChart from '../../components/dashboard/DashboardApexChart'
import { useTheme } from '../../context/useTheme'
import type { DashboardInventoryResponse } from '../../lib/dashboardXApi'
import { buildColumnOptions } from '../../lib/dashboardChartTheme'
import { toInt } from '../../lib/dashboardXUtils'

type DashboardXInventoryTabProps = {
  data: DashboardInventoryResponse
}

function DashboardXInventoryTab({ data }: DashboardXInventoryTabProps) {
  const { theme } = useTheme()
  const colors = theme.colors
  const inventory = data.inventory
  const movement = inventory.stockMovement

  const movementCategories = useMemo(
    () => ['Stock In', 'Remaining', 'Est. Stock Out'],
    [],
  )
  const movementSeries = useMemo(
    () => [
      {
        name: 'Units',
        data: [
          Number(movement.stockInTotal || 0),
          Number(movement.stockRemainingTotal || 0),
          Number(movement.estimatedStockOut || 0),
        ],
      },
    ],
    [movement.estimatedStockOut, movement.stockInTotal, movement.stockRemainingTotal],
  )
  const movementOptions = useMemo(
    () => buildColumnOptions(colors, movementCategories, { height: 280 }),
    [colors, movementCategories],
  )

  const movementTotal = movementSeries[0]?.data.reduce((sum, value) => sum + value, 0) ?? 0

  return (
    <article className="surface-card surface-card--wide">
      <div className="panel-header">
        <div>
          <h2>Inventory</h2>
          <p>Product counts and stock movement snapshot (current data).</p>
        </div>
      </div>

      <div className="dashboardx-inventory-grid">
        <article className="dashboardx-inventory-card dashboardx-inventory-card--neutral">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">🧾</div>
          <div>
            <span className="dashboardx-inventory-card__label">Products in Table</span>
            <strong>{toInt(inventory.totalProducts)}</strong>
          </div>
        </article>

        <article className="dashboardx-inventory-card dashboardx-inventory-card--info">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📥</div>
          <div>
            <span className="dashboardx-inventory-card__label">Stock In Total</span>
            <strong>{toInt(movement.stockInTotal)}</strong>
          </div>
        </article>

        <article className="dashboardx-inventory-card dashboardx-inventory-card--good">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📦</div>
          <div>
            <span className="dashboardx-inventory-card__label">Stock Remaining</span>
            <strong>{toInt(movement.stockRemainingTotal)}</strong>
          </div>
        </article>

        <article className="dashboardx-inventory-card dashboardx-inventory-card--outflow">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📤</div>
          <div>
            <span className="dashboardx-inventory-card__label">Estimated Stock Out</span>
            <strong>{toInt(movement.estimatedStockOut)}</strong>
          </div>
        </article>
      </div>

      <div className="dashboardx-chart-card" style={{ marginTop: 16 }}>
        <h3>Stock Movement Snapshot</h3>
        <DashboardApexChart
          type="bar"
          series={movementSeries}
          options={movementOptions}
          height={280}
          isEmpty={movementTotal <= 0}
          emptyMessage="No stock movement data available."
        />
      </div>

      <p className="dashboardx-note">{inventory.notes[0] || 'Inventory movement uses available product batch fields.'}</p>
    </article>
  )
}

export default DashboardXInventoryTab
