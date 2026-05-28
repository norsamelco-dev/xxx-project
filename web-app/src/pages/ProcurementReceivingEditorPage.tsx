import { useEffect, useMemo, useState } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import { Link, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'
import {
  confirmReceivingReport,
  fetchReceivingReport,
  formatProcurementDateTime,
  procurementStatusPillClass,
  updateReceivingReport,
  type ReceivingReport,
  type ReceivingReportItem,
} from '../lib/procurementApi'

type DraftLine = ReceivingReportItem & { key: string }

function ProcurementReceivingEditorPage() {
  const { id } = useParams()
  const reportId = Number(id)

  usePageVisitAudit(AUDIT_PAGES.PROCUREMENT_RECEIVING)

  const [report, setReport] = useState<ReceivingReport | null>(null)
  const [supplierDrNumber, setSupplierDrNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canEdit = report?.status === 'draft'

  const auditMeta = useMemo(
    () => ({
      page: AUDIT_PAGES.PROCUREMENT_RECEIVING,
      tableName: 'receiving_reports',
    }),
    [],
  )

  useEffect(() => {
    void loadPageData()
  }, [id])

  async function loadPageData() {
    if (!reportId || Number.isNaN(reportId)) {
      setError('Invalid receiving report id.')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError('')
      const response = await fetchReceivingReport(reportId)
      setReport(response.data)
      setSupplierDrNumber(response.data.supplier_dr_number || '')
      setRemarks(response.data.remarks || '')
      setLines(
        (response.data.items || []).map((line) => ({
          ...line,
          key: String(line.id || `${line.purchase_order_item_id}`),
        })),
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load receiving report.')
    } finally {
      setIsLoading(false)
    }
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function buildPayloadItems() {
    return lines.map((line) => ({
      purchase_order_item_id: line.purchase_order_item_id,
      product_name: line.product_name,
      sku: line.sku,
      product_barcode: line.product_barcode,
      qty_received: Number(line.qty_received || 0),
      item_condition: line.item_condition || 'good',
      expiry_date: line.expiry_date || null,
      batch_number: line.batch_number || '',
    }))
  }

  async function handleSaveDraft() {
    if (!report) {
      return
    }

    try {
      setIsSaving(true)
      setError('')
      const response = await updateReceivingReport(
        report.id,
        {
          supplier_dr_number: supplierDrNumber,
          remarks,
          items: buildPayloadItems(),
        },
        {
          ...auditMeta,
          action: 'UPDATE',
          description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_RECEIVING, `Updated RR ${report.rr_number}.`),
        },
      )
      setReport(response.data)
      setLines(
        (response.data.items || []).map((line) => ({
          ...line,
          key: String(line.id || `${line.purchase_order_item_id}`),
        })),
      )
      setSuccess(response.message || 'Receiving report saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save receiving report.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirm() {
    if (!report) {
      return
    }

    if (canEdit) {
      await handleSaveDraft()
    }

    try {
      setIsSaving(true)
      const response = await confirmReceivingReport(report.id, {
        ...auditMeta,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_RECEIVING, `Confirmed RR ${report.rr_number} and updated inventory.`),
      })
      setReport(response.data)
      setSuccess(response.message || 'Receiving report confirmed.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to confirm receiving report.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminShell title={report?.rr_number || 'Receiving Report'} description="Record quantities, condition, expiry, and batch details." hideTopbar>
      <section className="settings-stack procurement-editor-shell">
        <article className="surface-card surface-card--wide procurement-editor-card">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">
                <Link to="/procurement?tab=receiving">Procurement</Link> / {report?.rr_number || 'Receiving Report'}
              </p>
              {report ? (
                <p className="audit-card-description">
                  <span className={`status-pill status-pill--${procurementStatusPillClass(report.status)}`}>{report.status}</span>
                  {report.po_number ? ` · PO ${report.po_number}` : ''}
                </p>
              ) : null}
            </div>
            <Link to="/procurement?tab=receiving" className="button-secondary">
              <ButtonLabel icon="back">Back to List</ButtonLabel>
            </Link>
          </div>

          {error ? <p className="form-message form-message--error">{error}</p> : null}
          {success ? <p className="form-message form-message--success">{success}</p> : null}
          {isLoading ? <div className="empty-state">Loading receiving report...</div> : null}

          {!isLoading && report ? (
            <>
              <div className="procurement-meta-grid">
                <div>
                  <strong>PO #</strong>
                  <span>{report.po_number || ''}</span>
                </div>
                <div>
                  <strong>Created By</strong>
                  <span>{report.created_by_username || ''}</span>
                </div>
                <div>
                  <strong>Received By</strong>
                  <span>{report.received_by_username || ''}</span>
                </div>
                <div>
                  <strong>Received At</strong>
                  <span>{formatProcurementDateTime(report.received_at)}</span>
                </div>
              </div>

              <div className="procurement-form-grid">
                <label className="field">
                  <span>Supplier DR #</span>
                  <input type="text" value={supplierDrNumber} onChange={(event) => setSupplierDrNumber(event.target.value)} disabled={!canEdit} />
                </label>
                <label className="field procurement-form-grid__wide">
                  <span>Remarks</span>
                  <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} disabled={!canEdit} />
                </label>
              </div>

              <div className="table-wrap procurement-items-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Barcode</th>
                      <th>Qty Received</th>
                      <th>Condition</th>
                      <th>Expiry</th>
                      <th>Batch #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.key}>
                        <td>{line.product_name}</td>
                        <td>{line.product_barcode}</td>
                        <td>
                          {canEdit ? (
                            <input
                              type="number"
                              min="0"
                              value={line.qty_received}
                              onChange={(event) => updateLine(line.key, { qty_received: Number(event.target.value) })}
                            />
                          ) : (
                            line.qty_received
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <select value={line.item_condition} onChange={(event) => updateLine(line.key, { item_condition: event.target.value })}>
                              <option value="good">Good</option>
                              <option value="damaged">Damaged</option>
                            </select>
                          ) : (
                            line.item_condition
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="date"
                              value={line.expiry_date ? String(line.expiry_date).slice(0, 10) : ''}
                              onChange={(event) => updateLine(line.key, { expiry_date: event.target.value || null })}
                            />
                          ) : (
                            line.expiry_date ? String(line.expiry_date).slice(0, 10) : ''
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input type="text" value={line.batch_number || ''} onChange={(event) => updateLine(line.key, { batch_number: event.target.value })} />
                          ) : (
                            line.batch_number || ''
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="procurement-editor-actions">
                {canEdit ? (
                  <>
                    <ThemedButton type="button" variant="secondary" onClick={() => void handleSaveDraft()} disabled={isSaving}>
                      <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Save Draft'}</ButtonLabel>
                    </ThemedButton>
                    <ThemedButton type="button" variant="primary" onClick={() => void handleConfirm()} disabled={isSaving}>
                      <ButtonLabel icon="check">{isSaving ? 'Working...' : 'Confirm & Update Inventory'}</ButtonLabel>
                    </ThemedButton>
                  </>
                ) : null}
                {report.purchase_order_id ? (
                  <Link to={`/procurement/orders/${report.purchase_order_id}`} className="button-secondary">
                    <ButtonLabel icon="open">View PO</ButtonLabel>
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </article>
      </section>
    </AdminShell>
  )
}

export default ProcurementReceivingEditorPage
