import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import { useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { ButtonLabel, type ButtonIconName } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import {
  fetchDashboardDamageReports,
  fetchDashboardFinancial,
  fetchDashboardInventory,
  fetchDashboardOverview,
  fetchDashboardSales,
  type DashboardDamageReportsResponse,
  type DashboardFinancialResponse,
  type DashboardInventoryResponse,
  type DashboardOverviewResponse,
  type DashboardSalesResponse,
} from '../lib/dashboardXApi'
import { AUDIT_PAGES, buildAuditDescription, recordAuditEvent, type AuditMeta } from '../lib/audit'
import {
  buildFilterCacheKey,
  toCurrentYearNumber,
  toMonthDateRange,
  type DashboardGroupBy,
} from '../lib/dashboardXUtils'
import DashboardXOverviewTab from './dashboardx/DashboardXOverviewTab'
import DashboardXInventoryTab from './dashboardx/DashboardXInventoryTab'

const DashboardXSalesTab = lazy(() => import('./dashboardx/DashboardXSalesTab'))
const DashboardXFinancialTab = lazy(() => import('./dashboardx/DashboardXFinancialTab'))
const DashboardXDamageTab = lazy(() => import('./dashboardx/DashboardXDamageTab'))

type DashboardTabKey = 'overview' | 'sales' | 'inventory' | 'financial' | 'damage'

type DashboardTab = {
  key: DashboardTabKey
  label: string
  description: string
  icon: ButtonIconName
}

const DASHBOARD_TABS: DashboardTab[] = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'Key sales KPIs, inventory alerts, and a compact sales trend snapshot.',
    icon: 'view',
  },
  {
    key: 'sales',
    label: 'Sales',
    description: 'Sales trends, top products, category mix, peak hours, and discount/void metrics.',
    icon: 'generate',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Current inventory snapshot: stock levels, alerts, and movement estimates.',
    icon: 'details',
  },
  {
    key: 'financial',
    label: 'Financial',
    description: 'Payment mix, profit estimates, refunds, and tax collected for the selected period.',
    icon: 'settings',
  },
  {
    key: 'damage',
    label: 'Damage',
    description: 'Damage report drafts, sync activity, top reasons, and inventory deductions.',
    icon: 'delete',
  },
]

function isDashboardTab(value: string | null): value is DashboardTabKey {
  return value === 'overview' || value === 'sales' || value === 'inventory' || value === 'financial' || value === 'damage'
}

function DashboardXPage() {
  usePageVisitAudit(AUDIT_PAGES.DASHBOARD_X)

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = useMemo<DashboardTabKey>(() => {
    const requested = searchParams.get('tab')
    return isDashboardTab(requested) ? requested : 'overview'
  }, [searchParams])

  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all')
  const [selectedYear, setSelectedYear] = useState(() => toCurrentYearNumber())
  const [groupBy, setGroupBy] = useState<DashboardGroupBy>('yearly')
  const [appliedFilters, setAppliedFilters] = useState(() => {
    const range = toMonthDateRange(toCurrentYearNumber(), 'all')
    return {
      startDate: range.startDate,
      endDate: range.endDate,
      groupBy: 'yearly' as DashboardGroupBy,
    }
  })

  const [overviewData, setOverviewData] = useState<DashboardOverviewResponse | null>(null)
  const [salesData, setSalesData] = useState<DashboardSalesResponse | null>(null)
  const [inventoryData, setInventoryData] = useState<DashboardInventoryResponse | null>(null)
  const [financialData, setFinancialData] = useState<DashboardFinancialResponse | null>(null)
  const [damageData, setDamageData] = useState<DashboardDamageReportsResponse | null>(null)

  const [loadedCacheKeys, setLoadedCacheKeys] = useState<Set<string>>(() => new Set())
  const [loadingTab, setLoadingTab] = useState<DashboardTabKey | null>(null)
  const [error, setError] = useState('')

  const activeTabMeta = DASHBOARD_TABS.find((tab) => tab.key === activeTab) || DASHBOARD_TABS[0]

  const filterCacheKey = useMemo(
    () => buildFilterCacheKey(activeTab, appliedFilters.startDate, appliedFilters.endDate, appliedFilters.groupBy),
    [activeTab, appliedFilters.endDate, appliedFilters.startDate, appliedFilters.groupBy],
  )

  const yearOptions = useMemo(() => {
    const currentYear = toCurrentYearNumber()
    const years: number[] = []
    for (let year = currentYear - 5; year <= currentYear + 1; year += 1) {
      years.push(year)
    }
    return years
  }, [])

  const showDateFilters = activeTab === 'overview' || activeTab === 'sales' || activeTab === 'financial' || activeTab === 'damage'
  const showGroupByFilter = activeTab === 'overview' || activeTab === 'sales' || activeTab === 'damage'

  function handleTabChange(tabKey: DashboardTabKey) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tabKey)
    setSearchParams(nextParams)
  }

  const loadActiveTab = useCallback(
    async (options?: { force?: boolean; audit?: AuditMeta; filters?: typeof appliedFilters }) => {
      const force = Boolean(options?.force)
      const filters = options?.filters || appliedFilters
      const cacheKey = buildFilterCacheKey(activeTab, filters.startDate, filters.endDate, filters.groupBy)

      if (!force && loadedCacheKeys.has(cacheKey)) {
        return
      }

      try {
        setError('')
        setLoadingTab(activeTab)

        if (activeTab === 'overview') {
          const payload = await fetchDashboardOverview({
            startDate: filters.startDate,
            endDate: filters.endDate,
            groupBy: filters.groupBy,
            audit: options?.audit,
          })
          setOverviewData(payload)
        } else if (activeTab === 'sales') {
          const payload = await fetchDashboardSales({
            startDate: filters.startDate,
            endDate: filters.endDate,
            groupBy: filters.groupBy,
            audit: options?.audit,
          })
          setSalesData(payload)
        } else if (activeTab === 'inventory') {
          const payload = await fetchDashboardInventory(options?.audit)
          setInventoryData(payload)
        } else if (activeTab === 'financial') {
          const payload = await fetchDashboardFinancial({
            startDate: filters.startDate,
            endDate: filters.endDate,
            audit: options?.audit,
          })
          setFinancialData(payload)
        } else {
          const payload = await fetchDashboardDamageReports({
            startDate: filters.startDate,
            endDate: filters.endDate,
            groupBy: filters.groupBy,
            audit: options?.audit,
          })
          setDamageData(payload)
        }

        setLoadedCacheKeys((current) => {
          const next = new Set(current)
          next.add(cacheKey)
          return next
        })
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load DashboardX metrics.')
      } finally {
        setLoadingTab(null)
      }
    },
    [activeTab, appliedFilters, loadedCacheKeys],
  )

  useEffect(() => {
    void loadActiveTab()
  }, [activeTab, appliedFilters, loadActiveTab])

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const range = toMonthDateRange(selectedYear, selectedMonth)
    const nextFilters = {
      startDate: range.startDate,
      endDate: range.endDate,
      groupBy,
    }

    setAppliedFilters(nextFilters)
    setLoadedCacheKeys(new Set())

    try {
      await recordAuditEvent({
        page: AUDIT_PAGES.DASHBOARD_X,
        action: 'GENERATE REPORT',
        description: buildAuditDescription(
          AUDIT_PAGES.DASHBOARD_X,
          `Generated ${activeTab} dashboard report from ${range.startDate} to ${range.endDate} grouped by ${groupBy}.`,
        ),
      })
    } catch {
      // Audit failure should not block dashboard refresh.
    }
  }

  async function handleReload() {
    setLoadedCacheKeys((current) => {
      const next = new Set(current)
      next.delete(filterCacheKey)
      return next
    })
    await loadActiveTab({ force: true })
  }

  const isTabLoading = loadingTab === activeTab
  const hasTabData =
    (activeTab === 'overview' && overviewData)
    || (activeTab === 'sales' && salesData)
    || (activeTab === 'inventory' && inventoryData)
    || (activeTab === 'financial' && financialData)
    || (activeTab === 'damage' && damageData)

  return (
    <AdminShell title="DashboardX" description="Operational analytics with sales, inventory, and financial views." hideTopbar>
      <section className="settings-stack inventory-tabs-shell">
        {error ? <div className="error-state">{error}</div> : null}

        <article className="surface-card surface-card--wide inventory-workspace-card">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / DashboardX</p>
              <h1 className="audit-card-title">DashboardX</h1>
              <p className="audit-card-description">{activeTabMeta.description}</p>
            </div>

            <div className="audit-card-actions inventory-tabs-bar" role="tablist" aria-label="DashboardX tabs">
              {DASHBOARD_TABS.map((tab) => {
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

          <form className="sales-filter-bar dashboardx-filter-bar" onSubmit={(event) => void handleGenerate(event)}>
            {showDateFilters ? (
              <>
                <div className="field">
                  <label htmlFor="dashboardx_month">Month</label>
                  <select
                    id="dashboardx_month"
                    name="dashboardx_month"
                    value={selectedMonth}
                    onChange={(event) => {
                      const value = event.target.value
                      setSelectedMonth(value === 'all' ? 'all' : Number(value))
                    }}
                  >
                    <option value="all">All Months</option>
                    <option value={1}>January</option>
                    <option value={2}>February</option>
                    <option value={3}>March</option>
                    <option value={4}>April</option>
                    <option value={5}>May</option>
                    <option value={6}>June</option>
                    <option value={7}>July</option>
                    <option value={8}>August</option>
                    <option value={9}>September</option>
                    <option value={10}>October</option>
                    <option value={11}>November</option>
                    <option value={12}>December</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="dashboardx_year">Year</label>
                  <select
                    id="dashboardx_year"
                    name="dashboardx_year"
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : activeTab === 'inventory' ? (
              <p className="dashboardx-filter-note field">Inventory uses a live snapshot and does not use month/year filters.</p>
            ) : null}

            {showGroupByFilter ? (
              <div className="field">
                <label htmlFor="dashboardx_group_by">Trend Grouping</label>
                <select
                  id="dashboardx_group_by"
                  name="dashboardx_group_by"
                  value={groupBy}
                  onChange={(event) => setGroupBy(event.target.value as DashboardGroupBy)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            ) : null}

            <ThemedButton variant="primary" type="submit" disabled={isTabLoading}>
              <ButtonLabel icon="generate">{isTabLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
            </ThemedButton>

            <ThemedButton variant="secondary" type="button" onClick={() => void handleReload()} disabled={isTabLoading}>
              <ButtonLabel icon="reload">Reload</ButtonLabel>
            </ThemedButton>
          </form>
        </article>

        <div className="inventory-tab-content dashboardx-tab-content" role="tabpanel">
          {isTabLoading && !hasTabData ? <div className="empty-state">Loading {activeTabMeta.label} metrics...</div> : null}

          {activeTab === 'overview' && overviewData ? <DashboardXOverviewTab data={overviewData} /> : null}

          {activeTab === 'sales' && salesData ? (
            <Suspense fallback={<div className="empty-state">Loading sales charts...</div>}>
              <DashboardXSalesTab data={salesData} />
            </Suspense>
          ) : null}

          {activeTab === 'inventory' && inventoryData ? <DashboardXInventoryTab data={inventoryData} /> : null}

          {activeTab === 'financial' && financialData ? (
            <Suspense fallback={<div className="empty-state">Loading financial charts...</div>}>
              <DashboardXFinancialTab data={financialData} />
            </Suspense>
          ) : null}

          {activeTab === 'damage' && damageData ? (
            <Suspense fallback={<div className="empty-state">Loading damage report charts...</div>}>
              <DashboardXDamageTab data={damageData} />
            </Suspense>
          ) : null}
        </div>
      </section>
    </AdminShell>
  )
}

export default DashboardXPage
