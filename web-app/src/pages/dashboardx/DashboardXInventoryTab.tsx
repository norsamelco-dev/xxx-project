import type { DashboardInventoryResponse } from '../../lib/dashboardXApi'
import { toInt } from '../../lib/dashboardXUtils'

type DashboardXInventoryTabProps = {
  data: DashboardInventoryResponse
}

function DashboardXInventoryTab({ data }: DashboardXInventoryTabProps) {
  const inventory = data.inventory

  return (
    <article className="surface-card surface-card--wide">
      <div className="panel-header">
        <div>
          <h2>Inventory</h2>
          <p>Low stock, out of stock, stock movement, and near expiry alerts (current snapshot).</p>
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

        <article className="dashboardx-inventory-card dashboardx-inventory-card--warning">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">⚠️</div>
          <div>
            <span className="dashboardx-inventory-card__label">Low Stock Alerts</span>
            <strong>{toInt(inventory.lowStockAlerts)}</strong>
          </div>
        </article>

        <article className="dashboardx-inventory-card dashboardx-inventory-card--critical">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">⛔</div>
          <div>
            <span className="dashboardx-inventory-card__label">Out of Stock Items</span>
            <strong>{toInt(inventory.outOfStockItems)}</strong>
          </div>
        </article>

        <article className="dashboardx-inventory-card dashboardx-inventory-card--attention">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">⏳</div>
          <div>
            <span className="dashboardx-inventory-card__label">Near Expiry</span>
            <strong>{toInt(inventory.nearExpiryItems)}</strong>
          </div>
        </article>

        <article className="dashboardx-inventory-card dashboardx-inventory-card--info">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📥</div>
          <div>
            <span className="dashboardx-inventory-card__label">Stock In Total</span>
            <strong>{toInt(inventory.stockMovement.stockInTotal)}</strong>
          </div>
        </article>

        <article className="dashboardx-inventory-card dashboardx-inventory-card--good">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📦</div>
          <div>
            <span className="dashboardx-inventory-card__label">Stock Remaining</span>
            <strong>{toInt(inventory.stockMovement.stockRemainingTotal)}</strong>
          </div>
        </article>

        <article className="dashboardx-inventory-card dashboardx-inventory-card--outflow">
          <div className="dashboardx-inventory-card__icon" aria-hidden="true">📤</div>
          <div>
            <span className="dashboardx-inventory-card__label">Estimated Stock Out</span>
            <strong>{toInt(inventory.stockMovement.estimatedStockOut)}</strong>
          </div>
        </article>
      </div>
      <p className="dashboardx-note">{inventory.notes[0] || 'Inventory movement uses available product batch fields.'}</p>
    </article>
  )
}

export default DashboardXInventoryTab
