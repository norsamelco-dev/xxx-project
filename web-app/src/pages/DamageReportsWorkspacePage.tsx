import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ThemedDataGrid } from '../components/ThemedDataGrid'
import { ThemedButton } from '../components/ThemedButton'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'
import DamageReasonSettingsTab from './DamageReasonSettingsTab'

type DamageReportRow = {
  id: number
  report_number: string
  status: string
  remarks: string | null
  created_by_username: string | null
  created_at: string
  synced_by_username: string | null
  synced_at: string | null
  item_count: number
}

type DamageReportsResponse = {
  data: DamageReportRow[]
}

type SyncLogBatch = {
  id: number
  product_batch_id: number
  batch_id: string | null
  cost_price: number | null
  qty_before: number
  qty_deducted: number
  qty_after: number
}

type SyncLogItem = {
  id: number
  product_name: string
  sku: string
  product_barcode: string
  qty_requested: number
  qty_deducted: number
  damage_reason: string
  batches: SyncLogBatch[]
}

type SyncLog = {
  id: number
  damage_report_id: number
  report_number: string
  sync_batch_id: string
  synced_by_username: string | null
  synced_at: string
  status: string
  error_summary: string | null
  warnings: Array<{ product_barcode?: string; product_name?: string; message?: string }>
  items: SyncLogItem[]
}

type SyncLogsResponse = {
  data: SyncLog[]
  filters: {
    start_date: string | null
    end_date: string | null
    username: string | null
    report_number: string | null
    search: string | null
    limit: number
  }
  usernames: string[]
}

type WorkspaceTab = 'reports' | 'sync-logs' | 'settings'

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

function isWorkspaceTab(value: string | null): value is WorkspaceTab {
  return value === 'reports' || value === 'sync-logs' || value === 'settings'
}

function workspaceAuditPage(tab: WorkspaceTab) {
  if (tab === 'sync-logs') {
    return AUDIT_PAGES.DAMAGE_SYNC_LOGS
  }

  if (tab === 'settings') {
    return AUDIT_PAGES.DAMAGE_REASON_SETTINGS
  }

  return AUDIT_PAGES.DAMAGE_REPORTS
}

function DamageReportsWorkspacePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = useMemo<WorkspaceTab>(() => {
    const requested = searchParams.get('tab')
    return isWorkspaceTab(requested) ? requested : 'reports'
  }, [searchParams])

  usePageVisitAudit(workspaceAuditPage(activeTab))

  const [reports, setReports] = useState<DamageReportRow[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [syncLogUsernames, setSyncLogUsernames] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [syncStartDate, setSyncStartDate] = useState('')
  const [syncEndDate, setSyncEndDate] = useState('')
  const [syncUsername, setSyncUsername] = useState('')
  const [syncReportNumber, setSyncReportNumber] = useState('')
  const [syncSearch, setSyncSearch] = useState('')
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filteredSyncLogItemCount = useMemo(
    () => syncLogs.reduce((total, log) => total + (log.items?.length || 0), 0),
    [syncLogs],
  )

  useEffect(() => {
    if (activeTab === 'reports') {
      void loadReports()
    }
  }, [activeTab])

  function handleTabChange(tab: WorkspaceTab) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next)
  }

  async function loadReports() {
    try {
      setIsLoading(true)
      setError('')

      const params = new URLSearchParams()
      if (statusFilter) {
        params.set('status', statusFilter)
      }
      if (searchFilter.trim()) {
        params.set('search', searchFilter.trim())
      }

      const query = params.toString()
      const response = await apiFetch<DamageReportsResponse>(`/api/damage-reports${query ? `?${query}` : ''}`)
      setReports(response.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load damage reports.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSyncLogsGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadSyncLogs()
  }

  async function loadSyncLogs() {
    try {
      setIsLoading(true)
      setError('')

      const params = new URLSearchParams()
      if (syncStartDate) {
        params.set('start_date', syncStartDate)
      }
      if (syncEndDate) {
        params.set('end_date', syncEndDate)
      }
      if (syncUsername) {
        params.set('username', syncUsername)
      }
      if (syncReportNumber.trim()) {
        params.set('report_number', syncReportNumber.trim())
      }
      if (syncSearch.trim()) {
        params.set('search', syncSearch.trim())
      }

      const query = params.toString()
      const response = await apiFetch<SyncLogsResponse>(`/api/damage-reports/sync-logs${query ? `?${query}` : ''}`)
      setSyncLogs(response.data || [])
      setSyncLogUsernames(response.usernames || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load sync logs.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateReport() {
    try {
      setIsCreating(true)
      setError('')
      setSuccess('')

      const response = await apiFetch<{ data: DamageReportRow; message: string }>('/api/damage-reports', {
        method: 'POST',
        audit: {
          page: AUDIT_PAGES.DAMAGE_REPORTS,
          action: 'INSERT',
          description: buildAuditDescription(AUDIT_PAGES.DAMAGE_REPORTS, 'Created a new draft damage report.'),
          tableName: 'damage_reports',
        },
      })

      setSuccess(response.message || 'Draft damage report created.')
      navigate(`/damage-reports/${response.data.id}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create damage report.')
    } finally {
      setIsCreating(false)
    }
  }

  function toggleLogExpanded(logId: number) {
    setExpandedLogIds((current) => {
      const next = new Set(current)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  return (
    <AdminShell
      title="Damage Reports"
      description="Create draft damage reports, sync inventory deductions, and review sync audit logs."
      hideTopbar
    >
      <section className="settings-stack inventory-tabs-shell">
        <article className="surface-card surface-card--wide inventory-workspace-card">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Damage Reports</p>
              <p className="audit-card-description">
                {activeTab === 'reports'
                  ? 'Create and manage draft damage reports before syncing to inventory.'
                  : activeTab === 'sync-logs'
                    ? 'Review permanent sync logs across all damage reports.'
                    : 'Manage damage reason options shown when adding items to damage reports.'}
              </p>
            </div>
            <div className="audit-card-actions inventory-tabs-bar" role="tablist" aria-label="Damage reports workspace tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'reports'}
                className={`inventory-tab-trigger${activeTab === 'reports' ? ' is-active' : ''}`}
                onClick={() => handleTabChange('reports')}
              >
                <ButtonLabel icon="view">Damage Reports</ButtonLabel>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sync-logs'}
                className={`inventory-tab-trigger${activeTab === 'sync-logs' ? ' is-active' : ''}`}
                onClick={() => handleTabChange('sync-logs')}
              >
                <ButtonLabel icon="sync">Sync Logs</ButtonLabel>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'settings'}
                className={`inventory-tab-trigger${activeTab === 'settings' ? ' is-active' : ''}`}
                onClick={() => handleTabChange('settings')}
              >
                <ButtonLabel icon="settings">Settings</ButtonLabel>
              </button>
            </div>
          </div>

          {error ? <p className="form-message form-message--error">{error}</p> : null}
          {success ? <p className="form-message form-message--success">{success}</p> : null}

          {activeTab === 'settings' ? (
            <DamageReasonSettingsTab />
          ) : activeTab === 'reports' ? (
            <>
              <div className="audit-filter-bar damage-report-filter-bar">
                <label className="field">
                  <span>Status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="synced">Synced</option>
                  </select>
                </label>
                <label className="field">
                  <span>Search</span>
                  <input
                    type="search"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Report number or user"
                  />
                </label>
                <ThemedButton
                  type="button"
                  variant="secondary"
                  className="audit-generate-button"
                  onClick={() => void loadReports()}
                  disabled={isLoading}
                >
                  <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
                </ThemedButton>
                <ThemedButton type="button" variant="primary" onClick={() => void handleCreateReport()} disabled={isCreating}>
                  <ButtonLabel icon="plus">{isCreating ? 'Creating...' : 'New Draft Report'}</ButtonLabel>
                </ThemedButton>
              </div>

              {isLoading ? <div className="empty-state">Loading damage reports...</div> : null}

              {!isLoading && reports.length === 0 ? (
                <div className="empty-state">No damage reports found. Create a new draft report to get started.</div>
              ) : null}

              {!isLoading && reports.length > 0 ? (
                <ThemedDataGrid>
                  <table>
                    <thead>
                      <tr>
                        <th>Report #</th>
                        <th>Status</th>
                        <th>Items</th>
                        <th>Created By</th>
                        <th>Created At</th>
                        <th>Synced By</th>
                        <th>Synced At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((row) => (
                        <tr key={row.id}>
                          <td>{row.report_number}</td>
                          <td>
                            <span className={`status-pill status-pill--${row.status === 'synced' ? 'success' : 'pending'}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>{row.item_count}</td>
                          <td>{row.created_by_username || ''}</td>
                          <td>{formatDateTime(row.created_at)}</td>
                          <td>{row.synced_by_username || ''}</td>
                          <td>{formatDateTime(row.synced_at)}</td>
                          <td>
                            <Link to={`/damage-reports/${row.id}`} className="button-secondary button-secondary--compact">
                              <ButtonLabel icon="open">Open</ButtonLabel>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ThemedDataGrid>
              ) : null}
            </>
          ) : activeTab === 'sync-logs' ? (
            <>
              <form className="damage-report-sync-filter-bar" onSubmit={(event) => void handleSyncLogsGenerate(event)}>
                <label className="field" htmlFor="damage-sync-start-date">
                  <span>Start Date</span>
                  <input
                    id="damage-sync-start-date"
                    type="date"
                    value={syncStartDate}
                    onChange={(event) => setSyncStartDate(event.target.value)}
                  />
                </label>
                <label className="field" htmlFor="damage-sync-end-date">
                  <span>End Date</span>
                  <input
                    id="damage-sync-end-date"
                    type="date"
                    value={syncEndDate}
                    onChange={(event) => setSyncEndDate(event.target.value)}
                  />
                </label>
                <label className="field" htmlFor="damage-sync-username">
                  <span>User</span>
                  <select id="damage-sync-username" value={syncUsername} onChange={(event) => setSyncUsername(event.target.value)}>
                    <option value="">All users</option>
                    {syncLogUsernames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" htmlFor="damage-sync-report-number">
                  <span>Report #</span>
                  <input
                    id="damage-sync-report-number"
                    type="search"
                    value={syncReportNumber}
                    onChange={(event) => setSyncReportNumber(event.target.value)}
                    placeholder="DR-2026-001"
                  />
                </label>
                <label className="field" htmlFor="damage-sync-search">
                  <span>Search</span>
                  <input
                    id="damage-sync-search"
                    type="search"
                    value={syncSearch}
                    onChange={(event) => setSyncSearch(event.target.value)}
                    placeholder="Report, user, or error"
                  />
                </label>
                <ThemedButton type="submit" variant="primary" className="audit-generate-button" disabled={isLoading}>
                  <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
                </ThemedButton>
              </form>

              {isLoading ? <div className="empty-state">Loading sync logs...</div> : null}

              {!isLoading && syncLogs.length === 0 ? (
                <div className="empty-state">No sync logs found for the selected filters.</div>
              ) : null}

              {!isLoading && syncLogs.length > 0 ? (
                <article className="damage-report-sync-results-card">
                  <header className="damage-report-sync-results-card__header">
                    <div>
                      <h2 className="damage-report-sync-results-card__title">Sync Log Results</h2>
                      <p className="damage-report-sync-results-card__description">
                        Permanent audit records of inventory deductions synced from damage reports.
                      </p>
                    </div>
                    <div className="sync-history-summary damage-report-sync-results-card__summary">
                      <span>{syncLogs.length} sync record{syncLogs.length === 1 ? '' : 's'}</span>
                      <span>{filteredSyncLogItemCount} line item{filteredSyncLogItemCount === 1 ? '' : 's'}</span>
                    </div>
                  </header>

                  <div className="damage-report-sync-log-list">
                  {syncLogs.map((log) => {
                    const isExpanded = expandedLogIds.has(log.id)
                    return (
                      <article key={log.id} className="damage-report-sync-log-card">
                        <header className="damage-report-sync-log-card__header">
                            <div className="damage-report-sync-log-card__summary">
                            <h3 className="damage-report-sync-log-card__title">{log.report_number}</h3>
                            <p className="damage-report-sync-log-card__meta">
                              <span>{formatDateTime(log.synced_at)}</span>
                              <span>{log.synced_by_username || 'Unknown user'}</span>
                              <span className={`status-pill status-pill--${log.status === 'success' ? 'success' : 'error'}`}>
                                {log.status}
                              </span>
                              {log.sync_batch_id ? <span>Batch ref: {log.sync_batch_id}</span> : null}
                              <span>
                                {log.items.length} item{log.items.length === 1 ? '' : 's'}
                              </span>
                            </p>
                            {log.error_summary ? <p className="form-message form-message--error">{log.error_summary}</p> : null}
                          </div>
                          <div className="damage-report-sync-log-card__actions">
                            <Link to={`/damage-reports/${log.damage_report_id}`} className="button-secondary damage-report-sync-log-card__action">
                              <ButtonLabel icon="view">View Report</ButtonLabel>
                            </Link>
                            <ThemedButton
                              type="button"
                              variant="primary"
                              className="damage-report-sync-log-card__action"
                              onClick={() => toggleLogExpanded(log.id)}
                            >
                              <ButtonLabel icon={isExpanded ? 'hide' : 'details'}>
                                {isExpanded ? 'Hide Details' : 'Show Details'}
                              </ButtonLabel>
                            </ThemedButton>
                          </div>
                        </header>

                        {isExpanded ? (
                          <div className="damage-report-sync-log-card__body">
                            <ThemedDataGrid variant="damage-sync-log" className="damage-report-sync-log-card__table-wrap">
                              <table>
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th>Barcode</th>
                                  <th>Qty Requested</th>
                                  <th>Qty Deducted</th>
                                  <th>Reason</th>
                                  <th>Batches</th>
                                </tr>
                              </thead>
                              <tbody>
                                {log.items.map((item) => (
                                  <tr key={item.id}>
                                    <td>{item.product_name}</td>
                                    <td>{item.product_barcode}</td>
                                    <td>{item.qty_requested}</td>
                                    <td>{item.qty_deducted}</td>
                                    <td>{item.damage_reason}</td>
                                    <td>
                                      {item.batches.map((batch) => (
                                        <div key={batch.id} className="damage-batch-allocation">
                                          {batch.batch_id || `Batch ${batch.product_batch_id}`} · ₱{Number(batch.cost_price || 0).toFixed(2)} · -{batch.qty_deducted} ({batch.qty_before} → {batch.qty_after})
                                        </div>
                                      ))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              </table>
                            </ThemedDataGrid>
                          </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                </article>
              ) : null}
            </>
          ) : null}
        </article>
      </section>
    </AdminShell>
  )
}

export default DamageReportsWorkspacePage
