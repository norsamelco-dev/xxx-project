import { Fragment, useMemo, useState, type FormEvent } from 'react'
import { ThemedDataGrid } from '../components/ThemedDataGrid'
import { ThemedButton } from '../components/ThemedButton'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'

type SyncHistoryRow = {
  id: number
  sync_batch_id: string | null
  sync_code: string | null
  sync_timestamp: string | null
  user_id: string | null
  username: string | null
  product_barcode: string | null
  product_name: string | null
  batch_id: string | null
  qty_before: number
  qty_added: number
  qty_after: number
  cost_price: number | null
  selling_price: number | null
  expiration_date: string | null
  source: string | null
}

type SyncHistoryResponse = {
  data: SyncHistoryRow[]
  filters: {
    start_date: string | null
    end_date: string | null
    search: string | null
    limit: number
  }
}

type SyncHistoryGroup = {
  key: string
  syncCode: string
  syncBatchId: string | null
  syncTimestamp: string | null
  userId: string | null
  username: string | null
  rows: SyncHistoryRow[]
  totalQtyAdded: number
}

function getSyncGroupKey(row: SyncHistoryRow) {
  return row.sync_code?.trim() || row.sync_batch_id?.trim() || `row-${row.id}`
}

function groupSyncHistoryRows(rows: SyncHistoryRow[]) {
  const groups = new Map<string, SyncHistoryGroup>()
  const orderedKeys: string[] = []

  for (const row of rows) {
    const key = getSyncGroupKey(row)
    const existing = groups.get(key)

    if (existing) {
      existing.rows.push(row)
      existing.totalQtyAdded += Number(row.qty_added || 0)
      continue
    }

    orderedKeys.push(key)
    groups.set(key, {
      key,
      syncCode: row.sync_code?.trim() || row.sync_batch_id?.trim() || `Record ${row.id}`,
      syncBatchId: row.sync_batch_id,
      syncTimestamp: row.sync_timestamp,
      userId: row.user_id,
      username: row.username,
      rows: [row],
      totalQtyAdded: Number(row.qty_added || 0),
    })
  }

  return orderedKeys.map((key) => {
    const group = groups.get(key)
    if (!group) {
      return null
    }

    return {
      ...group,
      rows: [...group.rows].sort((left, right) => left.id - right.id),
    }
  }).filter((group): group is SyncHistoryGroup => group !== null)
}

function formatDateTime(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString()
}

function formatDate(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleDateString()
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) {
    return ''
  }

  return Number(value).toFixed(2)
}

function getDateRangeFromMonthYear(monthFilter: string, yearFilter: string) {
  const parsedYear = Number(yearFilter)

  if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 9999) {
    return {
      startDate: '',
      endDate: '',
    }
  }

  if (monthFilter === 'all') {
    return {
      startDate: `${parsedYear}-01-01`,
      endDate: `${parsedYear}-12-31`,
    }
  }

  const parsedMonth = Number(monthFilter)

  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return {
      startDate: '',
      endDate: '',
    }
  }

  const monthText = String(parsedMonth).padStart(2, '0')
  const lastDay = new Date(parsedYear, parsedMonth, 0).getDate()

  return {
    startDate: `${parsedYear}-${monthText}-01`,
    endDate: `${parsedYear}-${monthText}-${String(lastDay).padStart(2, '0')}`,
  }
}

type StockSyncHistoryPageProps = {
  embedded?: boolean
}

function StockSyncHistoryPage({ embedded = false }: StockSyncHistoryPageProps) {
  usePageVisitAudit(AUDIT_PAGES.INVENTORY_SYNC_HISTORY)
  const currentYear = new Date().getFullYear()
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState(String(currentYear))
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<SyncHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [error, setError] = useState('')

  const yearOptions = Array.from({ length: 8 }, (_value, index) => String(currentYear - index))

  const groupedRows = useMemo(() => groupSyncHistoryRows(rows), [rows])

  async function fetchHistory(nextMonthFilter: string, nextYearFilter: string, nextSearch: string) {
    try {
      setError('')
      setIsLoading(true)

      const { startDate, endDate } = getDateRangeFromMonthYear(nextMonthFilter, nextYearFilter)
      const queryParams = new URLSearchParams()
      if (startDate.trim()) {
        queryParams.set('start_date', startDate.trim())
      }

      if (endDate.trim()) {
        queryParams.set('end_date', endDate.trim())
      }

      if (nextSearch.trim()) {
        queryParams.set('search', nextSearch.trim())
      }

      queryParams.set('limit', '500')

      const response = await apiFetch<SyncHistoryResponse>(`/api/stock-batch/sync-history?${queryParams.toString()}`, {
        audit: {
          page: AUDIT_PAGES.INVENTORY_SYNC_HISTORY,
          action: 'GENERATE REPORT',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_SYNC_HISTORY,
            `Generated sync history report for ${nextMonthFilter === 'all' ? 'all months' : `month ${nextMonthFilter}`}, ${nextYearFilter}${nextSearch.trim() ? `, search "${nextSearch.trim()}"` : ''}.`,
          ),
          tableName: 'product_batches_sync_history',
        },
      })
      setRows(response.data || [])

      if (response.filters?.search !== undefined && response.filters.search !== null) {
        setSearch(response.filters.search)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sync history.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHasGenerated(true)
    await fetchHistory(monthFilter, yearFilter, search)
  }

  const content = (
    <>
      <section className="settings-stack">
        {error ? <div className="error-state">{error}</div> : null}

        <article className="surface-card surface-card--wide">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Sync History</p>
              <h1 className="audit-card-title">SYNC HISTORY</h1>
              <p className="audit-card-description">
                Review sync transactions grouped by sync code, with line-item quantities for each product synced.
              </p>
            </div>
          </div>

          <form className="sync-history-filter-bar" onSubmit={handleGenerate}>
            <div className="field">
              <label htmlFor="sync_history_month">Month</label>
              <select id="sync_history_month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="sync_history_year">Year</label>
              <select id="sync_history_year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="sync_history_search">Search</label>
              <input
                id="sync_history_search"
                type="search"
                placeholder="Barcode, product, user, sync code, batch"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <ThemedButton variant="primary" className="sync-history-generate-button" type="submit" disabled={isLoading}>
              <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
            </ThemedButton>
          </form>

          {isLoading ? <div className="empty-state">Loading sync history...</div> : null}
          {!isLoading && !hasGenerated ? <div className="empty-state">Set filters and click Generate to view sync logs.</div> : null}
          {!isLoading && hasGenerated && rows.length === 0 ? (
            <div className="empty-state">No sync history records found with these filters.</div>
          ) : null}

          {!isLoading && hasGenerated && rows.length > 0 ? (
            <div className="sync-history-summary">
              <span>{groupedRows.length} sync transaction(s)</span>
              <span>{rows.length} line item(s)</span>
            </div>
          ) : null}

          {!isLoading && hasGenerated && rows.length > 0 ? (
            <ThemedDataGrid variant="sync-history" className="sync-history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Barcode</th>
                    <th>Product</th>
                    <th>Batch ID</th>
                    <th>Current Qty</th>
                    <th>Sync Qty</th>
                    <th>After Qty</th>
                    <th>Cost</th>
                    <th>Selling</th>
                    <th>Expiration</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((group) => (
                    <Fragment key={group.key}>
                      <tr className="sync-history-group-header">
                        <td colSpan={10}>
                          <div className="sync-history-group-banner">
                            <div className="sync-history-group-banner__primary">
                              <span className="sync-history-group-label">Sync Transaction</span>
                              <strong className="sync-history-group-code">{group.syncCode}</strong>
                              <span className="sync-history-group-count">
                                {group.rows.length === 1 ? '1 product' : `${group.rows.length} products`}
                              </span>
                            </div>
                            <div className="sync-history-group-banner__meta">
                              <span>{formatDateTime(group.syncTimestamp)}</span>
                              <span>
                                {group.username || 'Unknown user'}
                                {group.userId ? ` (${group.userId})` : ''}
                              </span>
                              <span>Total synced qty: {group.totalQtyAdded}</span>
                              {group.syncBatchId ? (
                                <span className="sync-history-group-batch">Batch ref: {group.syncBatchId}</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {group.rows.map((row, index) => (
                        <tr key={row.id} className="sync-history-group-item">
                          <td>{index + 1}</td>
                          <td>{row.product_barcode || ''}</td>
                          <td>{row.product_name || ''}</td>
                          <td>{row.batch_id || ''}</td>
                          <td>
                            <span className="stock-batch-sync-qty stock-batch-sync-qty--before">{Number(row.qty_before || 0)}</span>
                          </td>
                          <td>
                            <span className="stock-batch-sync-qty stock-batch-sync-qty--add">{Number(row.qty_added || 0)}</span>
                          </td>
                          <td>
                            <span className="stock-batch-sync-qty stock-batch-sync-qty--after">{Number(row.qty_after || 0)}</span>
                          </td>
                          <td>{formatCurrency(row.cost_price)}</td>
                          <td>{formatCurrency(row.selling_price)}</td>
                          <td>{formatDate(row.expiration_date)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </ThemedDataGrid>
          ) : null}
        </article>
      </section>
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <AdminShell
      title="SYNC HISTORY"
      description="Review who synced product quantities from stock batch template into inventory."
      hideTopbar
    >
      {content}
    </AdminShell>
  )
}

export default StockSyncHistoryPage
