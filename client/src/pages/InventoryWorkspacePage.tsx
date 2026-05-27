import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { ButtonLabel, type ButtonIconName } from '../components/ButtonIcon'
import AddStockBatchPage from './AddStockBatchPage'
import ProductsPage from './ProductsPage'
import StockSyncHistoryPage from './StockSyncHistoryPage'

type InventoryTabKey = 'products' | 'add-stock-batch' | 'sync-history'

type InventoryTab = {
  key: InventoryTabKey
  label: string
  description: string
  icon: ButtonIconName
}

const INVENTORY_TABS: InventoryTab[] = [
  {
    key: 'products',
    label: 'Products',
    description: 'Manage product master records and product-level sync history.',
    icon: 'view',
  },
  {
    key: 'add-stock-batch',
    label: 'Add Stock Batch',
    description: 'Stage stock batch items from barcode input before syncing to inventory.',
    icon: 'plus',
  },
  {
    key: 'sync-history',
    label: 'Sync History',
    description: 'Audit inventory sync logs, quantities, and responsible users.',
    icon: 'sync',
  },
]

function isInventoryTab(value: string | null): value is InventoryTabKey {
  return value === 'products' || value === 'add-stock-batch' || value === 'sync-history'
}

function InventoryWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = useMemo<InventoryTabKey>(() => {
    const requestedTab = searchParams.get('tab')
    if (isInventoryTab(requestedTab)) {
      return requestedTab
    }

    return 'products'
  }, [searchParams])

  function handleTabChange(tabKey: InventoryTabKey) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tabKey)
    setSearchParams(nextParams)
  }

  const activeTabMeta = INVENTORY_TABS.find((tab) => tab.key === activeTab) || INVENTORY_TABS[0]

  return (
    <AdminShell
      title="Inventory Workspace"
      description="Manage products, stock batch staging, and sync history in one workspace."
      hideTopbar
    >
      <section className="settings-stack inventory-tabs-shell">
        <article className="surface-card surface-card--wide inventory-workspace-card">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Inventory Workspace</p>
              <p className="audit-card-description">{activeTabMeta.description}</p>
            </div>
            <div className="audit-card-actions inventory-tabs-bar" role="tablist" aria-label="Inventory workspace tabs">
              {INVENTORY_TABS.map((tab) => {
                const isActive = tab.key === activeTab
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`inventory-tab-trigger${isActive ? ' is-active' : ''}`}
                    onClick={() => handleTabChange(tab.key)}
                  >
                    <ButtonLabel icon={tab.icon}>{tab.label}</ButtonLabel>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="inventory-tab-content" role="tabpanel">
            {activeTab === 'products' ? <ProductsPage embedded /> : null}
            {activeTab === 'add-stock-batch' ? <AddStockBatchPage embedded /> : null}
            {activeTab === 'sync-history' ? <StockSyncHistoryPage embedded /> : null}
          </div>
        </article>
      </section>
    </AdminShell>
  )
}

export default InventoryWorkspacePage
