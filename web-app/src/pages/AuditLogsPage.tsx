import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ThemedDataGrid } from '../components/ThemedDataGrid'
import { ThemedButton } from '../components/ThemedButton'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import PdfExportSettingsModal from '../components/PdfExportSettingsModal'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription, recordAuditEvent } from '../lib/audit'
import {
  addPdfPageNumbers,
  createPdfDocument,
  drawPdfBusinessHeader,
  formatPdfExportLabel,
  type PdfExportOptions,
  type PdfOrientation,
  type PdfPaperSize,
  type ReceiptHeadingPublic,
} from '../lib/pdfExport'

type AuditLogRecord = {
  id: number
  user_id: string
  username: string
  action_type: string
  table_name: string | null
  product_barcode: string | null
  description: string | null
  machineid: string | null
  ptunumber: string | null
  ip_address: string | null
  device_info: string | null
  created_at: string | null
}

type AuditLogsResponse = {
  data: AuditLogRecord[]
  filters: {
    start_date: string
    end_date: string
    username: string | null
  }
}

type AuditLogUserOption = {
  user_id: string
  username: string
}

type AuditLogUsersResponse = {
  data: AuditLogUserOption[]
}

function getTodayLocalDate() {
  const date = new Date()
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10)
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

function AuditLogsPage() {
  usePageVisitAudit(AUDIT_PAGES.AUDIT_LOGS)
  const defaultDate = useMemo(() => getTodayLocalDate(), [])
  const [startDate, setStartDate] = useState(defaultDate)
  const [endDate, setEndDate] = useState(defaultDate)
  const [usernameFilter, setUsernameFilter] = useState('all')
  const [userOptions, setUserOptions] = useState<AuditLogUserOption[]>([])
  const [receiptHeading, setReceiptHeading] = useState<ReceiptHeadingPublic | null>(null)
  const [rows, setRows] = useState<AuditLogRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [pdfPaperSize, setPdfPaperSize] = useState<PdfPaperSize>('a4')
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('landscape')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void loadUsers()
    void loadReceiptHeadingPublic()
  }, [])

  async function loadUsers() {
    try {
      const response = await apiFetch<AuditLogUsersResponse>('/api/audit-logs/users')
      setUserOptions(response.data || [])
    } catch (_error) {
      setUserOptions([])
    }
  }

  async function loadReceiptHeadingPublic() {
    try {
      const response = await apiFetch<{ data: ReceiptHeadingPublic | null }>('/api/receipt-heading/public')
      setReceiptHeading(response.data)
    } catch (_error) {
      setReceiptHeading(null)
    }
  }

  async function fetchLogs(nextStartDate: string, nextEndDate: string, nextUsernameFilter: string) {
    try {
      setError('')
      setSuccess('')
      setIsLoading(true)
      const queryParams = new URLSearchParams()
      queryParams.set('start_date', nextStartDate)
      queryParams.set('end_date', nextEndDate)

      if (nextUsernameFilter !== 'all') {
        queryParams.set('username', nextUsernameFilter)
      }

      const response = await apiFetch<AuditLogsResponse>(`/api/audit-logs?${queryParams.toString()}`)

      const fetchedRows = response.data || []
      setRows(fetchedRows)

      void recordAuditEvent({
        page: AUDIT_PAGES.AUDIT_LOGS,
        action: 'GENERATE REPORT',
        description: buildAuditDescription(
          AUDIT_PAGES.AUDIT_LOGS,
          `Generated audit logs report from ${nextStartDate} to ${nextEndDate}${nextUsernameFilter !== 'all' ? ` for user ${nextUsernameFilter}` : ''}.`,
        ),
        tableName: 'audit_logs',
      }).catch(() => {
        // Report generation should succeed even if audit recording fails.
      })

      if (response.filters?.start_date) {
        setStartDate(response.filters.start_date)
      }

      if (response.filters?.end_date) {
        setEndDate(response.filters.end_date)
      }

      if (response.filters?.username) {
        setUsernameFilter(response.filters.username)
      }

      return fetchedRows
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit logs.')
      return []
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHasGenerated(true)
    await fetchLogs(startDate, endDate, usernameFilter)
  }

  function handleExportPdfClick() {
    if (rows.length === 0) {
      setError('Load audit logs using Generate before exporting to PDF.')
      return
    }

    setError('')
    setIsPdfModalOpen(true)
  }

  function closePdfModal() {
    if (isExporting) {
      return
    }

    setIsPdfModalOpen(false)
  }

  async function handleConfirmPdfExport() {
    if (rows.length === 0) {
      setError('No audit logs available to export.')
      return
    }

    const exportOptions: PdfExportOptions = {
      paperSize: pdfPaperSize,
      orientation: pdfOrientation,
    }

    try {
      setError('')
      setSuccess('')
      setIsExporting(true)

      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = createPdfDocument(jsPDF, exportOptions.paperSize, exportOptions.orientation)
      const pageWidth = doc.internal.pageSize.getWidth()
      const leftMargin = 36
      const reportTitleY = await drawPdfBusinessHeader(doc, receiptHeading, leftMargin)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text('Audit Logs Report', pageWidth / 2, reportTitleY, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const dateRangeLabel = `${startDate || '-'} to ${endDate || '-'}`
      const userLabel = usernameFilter === 'all' ? 'All users' : usernameFilter
      doc.text(`Date Range: ${dateRangeLabel}`, pageWidth / 2, reportTitleY + 16, { align: 'center' })
      doc.text(`User Filter: ${userLabel}`, pageWidth / 2, reportTitleY + 30, { align: 'center' })

      autoTable(doc, {
        startY: reportTitleY + 44,
        head: [[
          'Date/Time',
          'User ID',
          'Username',
          'Action',
          'Table',
          'Barcode',
          'Description',
          'Machine ID',
          'PTU Number',
          'IP Address',
        ]],
        body: rows.map((row) => [
          formatDateTime(row.created_at),
          row.user_id || '',
          row.username || '',
          row.action_type || '',
          row.table_name || '',
          row.product_barcode || '',
          row.description || '',
          row.machineid || '',
          row.ptunumber || '',
          row.ip_address || '',
        ]),
        theme: 'grid',
        styles: {
          fontSize: 7.8,
          cellPadding: 4,
          valign: 'middle',
          lineColor: [224, 229, 236],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [17, 24, 39],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 251, 253],
        },
      })

      addPdfPageNumbers(doc, leftMargin)

      const fileDate = new Date().toISOString().slice(0, 10)
      doc.save(`audit-logs-${fileDate}.pdf`)
      setSuccess('Audit logs PDF exported successfully.')
      setIsPdfModalOpen(false)

      await recordAuditEvent({
        page: AUDIT_PAGES.AUDIT_LOGS,
        action: 'EXPORT',
        description: buildAuditDescription(
          AUDIT_PAGES.AUDIT_LOGS,
          `Exported audit logs PDF (${formatPdfExportLabel(exportOptions)}) from ${startDate} to ${endDate}${usernameFilter !== 'all' ? ` for user ${usernameFilter}` : ''}.`,
        ),
        tableName: 'audit_logs',
      })
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export audit logs PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AdminShell
      title="AUDIT LOGS"
      description="Track system activity by date range across API actions and modules."
      hideTopbar
    >
      <section className="settings-stack">
        {error ? <div className="error-state">{error}</div> : null}
        {success ? <div className="success-state">{success}</div> : null}

        <article className="surface-card surface-card--wide admin-page-main">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / AUDIT LOGS</p>
              <h1 className="audit-card-title">AUDIT LOGS</h1>
              <p className="audit-card-description">Track system activity by date range across API actions and modules.</p>
            </div>

          </div>

          <form className="audit-filter-bar" onSubmit={handleGenerate}>
            <div className="field">
              <label htmlFor="audit_start_date">Select Range: From</label>
              <input
                id="audit_start_date"
                name="audit_start_date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="audit_end_date">To</label>
              <input
                id="audit_end_date"
                name="audit_end_date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="audit_username_filter">User</label>
              <select
                id="audit_username_filter"
                value={usernameFilter}
                onChange={(event) => setUsernameFilter(event.target.value)}
              >
                <option value="all">All users</option>
                {userOptions.map((user) => (
                  <option key={`${user.user_id}-${user.username}`} value={user.username}>
                    {user.username} ({user.user_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="audit-filter-actions">
              <ThemedButton variant="primary" className="audit-generate-button" type="submit" disabled={isLoading}>
                <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
              </ThemedButton>
              <button
                className="topbar-button topbar-button--ghost audit-export-button"
                type="button"
                onClick={handleExportPdfClick}
                disabled={isLoading || isExporting || rows.length === 0}
              >
                <ButtonLabel icon="export">{isExporting ? 'Exporting PDF...' : 'Export to PDF'}</ButtonLabel>
              </button>
            </div>
          </form>

          {isLoading ? <div className="empty-state">Loading audit logs...</div> : null}
          {!isLoading && !hasGenerated ? <div className="empty-state">Select filters, then click Generate.</div> : null}
          {!isLoading && hasGenerated && rows.length === 0 ? (
            <div className="empty-state">No audit log records found in this range.</div>
          ) : null}

          {!isLoading && hasGenerated && rows.length > 0 ? (
            <ThemedDataGrid className="audit-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date/Time</th>
                    <th>User ID</th>
                    <th>Username</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Barcode</th>
                    <th>Description</th>
                    <th>Machine ID</th>
                    <th>PTU Number</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td>{row.user_id}</td>
                      <td>{row.username}</td>
                      <td>{row.action_type}</td>
                      <td>{row.table_name || ''}</td>
                      <td>{row.product_barcode || ''}</td>
                      <td>{row.description || ''}</td>
                      <td>{row.machineid || ''}</td>
                      <td>{row.ptunumber || ''}</td>
                      <td>{row.ip_address || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ThemedDataGrid>
          ) : null}
        </article>
      </section>

      {isPdfModalOpen ? (
        <PdfExportSettingsModal
          title="Export Audit Logs PDF"
          description="Choose the paper size and orientation before generating the PDF."
          paperSize={pdfPaperSize}
          orientation={pdfOrientation}
          isExporting={isExporting}
          onPaperSizeChange={setPdfPaperSize}
          onOrientationChange={setPdfOrientation}
          onCancel={closePdfModal}
          onConfirm={() => void handleConfirmPdfExport()}
        />
      ) : null}
    </AdminShell>
  )
}

export default AuditLogsPage