import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import { Link, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'
import {
  cancelOrder,
  fetchOrder,
  fetchSuppliers,
  formatMoney,
  formatProcurementDateTime,
  procurementStatusPillClass,
  sendOrder,
  updateOrder,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type Supplier,
} from '../lib/procurementApi'

function ProcurementOrderEditorPage() {
  const { id } = useParams()
  const orderId = Number(id)

  usePageVisitAudit(AUDIT_PAGES.PROCUREMENT_ORDER)

  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [lineCosts, setLineCosts] = useState<Record<number, string>>({})
  const [lineQty, setLineQty] = useState<Record<number, string>>({})
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canEdit = order?.status === 'draft'

  const auditMeta = useMemo(
    () => ({
      page: AUDIT_PAGES.PROCUREMENT_ORDER,
      tableName: 'purchase_orders',
    }),
    [],
  )

  useEffect(() => {
    void loadPageData()
  }, [id])

  async function loadPageData() {
    if (!orderId || Number.isNaN(orderId)) {
      setError('Invalid purchase order id.')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError('')
      const [orderResponse, supplierResponse] = await Promise.all([fetchOrder(orderId), fetchSuppliers()])
      const po = orderResponse.data
      setOrder(po)
      setSuppliers(supplierResponse.data || [])
      setSupplierId(String(po.supplier_id || ''))
      setExpectedDeliveryDate(po.expected_delivery_date ? String(po.expected_delivery_date).slice(0, 10) : '')
      setLineCosts(Object.fromEntries((po.items || []).map((line) => [line.id, String(line.unit_cost)])))
      setLineQty(Object.fromEntries((po.items || []).map((line) => [line.id, String(line.qty_ordered)])))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load purchase order.')
    } finally {
      setIsLoading(false)
    }
  }

  function buildItemPayload(items: PurchaseOrderItem[]) {
    return items.map((line) => ({
      id: line.id,
      qty_ordered: lineQty[line.id] !== undefined ? Number(lineQty[line.id]) : line.qty_ordered,
      unit_cost: lineCosts[line.id] !== undefined ? Number(lineCosts[line.id]) : line.unit_cost,
    }))
  }

  async function handleSaveDraft() {
    if (!order) {
      return
    }

    try {
      setIsSaving(true)
      setError('')
      const response = await updateOrder(
        order.id,
        {
          supplier_id: supplierId ? Number(supplierId) : undefined,
          expected_delivery_date: expectedDeliveryDate || undefined,
          items: buildItemPayload(order.items || []),
        },
        {
          ...auditMeta,
          action: 'UPDATE',
          description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_ORDER, `Updated PO ${order.po_number}.`),
        },
      )
      setOrder(response.data)
      setSuccess(response.message || 'Purchase order saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save purchase order.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSend() {
    if (!order) {
      return
    }

    if (canEdit) {
      await handleSaveDraft()
    }

    try {
      setIsSaving(true)
      const response = await sendOrder(order.id, {
        ...auditMeta,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_ORDER, `Sent PO ${order.po_number} to supplier.`),
      })
      setOrder(response.data)
      setSuccess(response.message || 'Purchase order sent.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to send purchase order.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancel(event: FormEvent) {
    event.preventDefault()
    if (!order || !cancelReason.trim()) {
      setError('Cancel reason is required.')
      return
    }

    try {
      setIsSaving(true)
      const response = await cancelOrder(order.id, cancelReason.trim(), {
        ...auditMeta,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_ORDER, `Cancelled PO ${order.po_number}.`),
      })
      setOrder(response.data)
      setSuccess(response.message || 'Purchase order cancelled.')
      setIsCancelOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to cancel purchase order.')
    } finally {
      setIsSaving(false)
    }
  }

  const lineTotal = useMemo(() => {
    if (!order?.items) {
      return 0
    }

    return order.items.reduce((sum, line) => {
      const qty = lineQty[line.id] !== undefined ? Number(lineQty[line.id]) : line.qty_ordered
      const cost = lineCosts[line.id] !== undefined ? Number(lineCosts[line.id]) : line.unit_cost
      return sum + qty * cost
    }, 0)
  }, [order, lineCosts, lineQty])

  return (
    <AdminShell title={order?.po_number || 'Purchase Order'} description="Edit, send, or cancel purchase orders." hideTopbar>
      <section className="settings-stack procurement-editor-shell">
        <article className="surface-card surface-card--wide procurement-editor-card">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">
                <Link to="/procurement?tab=orders">Procurement</Link> / {order?.po_number || 'Purchase Order'}
              </p>
              {order ? (
                <p className="audit-card-description">
                  <span className={`status-pill status-pill--${procurementStatusPillClass(order.status)}`}>{order.status}</span>
                  {order.pr_number ? ` · PR ${order.pr_number}` : ''}
                  {order.cancel_reason ? ` · ${order.cancel_reason}` : ''}
                </p>
              ) : null}
            </div>
            <Link to="/procurement?tab=orders" className="button-secondary">
              <ButtonLabel icon="back">Back to List</ButtonLabel>
            </Link>
          </div>

          {error ? <p className="form-message form-message--error">{error}</p> : null}
          {success ? <p className="form-message form-message--success">{success}</p> : null}
          {isLoading ? <div className="empty-state">Loading purchase order...</div> : null}

          {!isLoading && order ? (
            <>
              <div className="procurement-meta-grid">
                <div>
                  <strong>Supplier</strong>
                  <span>{order.supplier_name || ''}</span>
                </div>
                <div>
                  <strong>Created</strong>
                  <span>{formatProcurementDateTime(order.created_at)}</span>
                </div>
                <div>
                  <strong>Sent</strong>
                  <span>{formatProcurementDateTime(order.sent_at)}</span>
                </div>
                <div>
                  <strong>Total</strong>
                  <span>{formatMoney(lineTotal)}</span>
                </div>
              </div>

              <div className="procurement-form-grid">
                <label className="field">
                  <span>Supplier</span>
                  <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} disabled={!canEdit}>
                    {suppliers.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.supplier_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Expected Delivery</span>
                  <input type="date" value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} disabled={!canEdit} />
                </label>
              </div>

              <div className="table-wrap procurement-items-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Barcode</th>
                      <th>Qty Ordered</th>
                      <th>Qty Received</th>
                      <th>Unit Cost</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((line) => {
                      const qty = lineQty[line.id] !== undefined ? Number(lineQty[line.id]) : line.qty_ordered
                      const cost = lineCosts[line.id] !== undefined ? Number(lineCosts[line.id]) : line.unit_cost
                      return (
                        <tr key={line.id}>
                          <td>{line.product_name}</td>
                          <td>{line.product_barcode}</td>
                          <td>
                            {canEdit ? (
                              <input type="number" min="1" value={lineQty[line.id] ?? line.qty_ordered} onChange={(event) => setLineQty((current) => ({ ...current, [line.id]: event.target.value }))} />
                            ) : (
                              line.qty_ordered
                            )}
                          </td>
                          <td>{line.qty_received}</td>
                          <td>
                            {canEdit ? (
                              <input type="number" min="0" step="0.01" value={lineCosts[line.id] ?? line.unit_cost} onChange={(event) => setLineCosts((current) => ({ ...current, [line.id]: event.target.value }))} />
                            ) : (
                              formatMoney(line.unit_cost)
                            )}
                          </td>
                          <td>{formatMoney(qty * cost)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="procurement-editor-actions">
                {canEdit ? (
                  <>
                    <ThemedButton type="button" variant="secondary" onClick={() => void handleSaveDraft()} disabled={isSaving}>
                      <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Save Draft'}</ButtonLabel>
                    </ThemedButton>
                    <ThemedButton type="button" variant="primary" onClick={() => void handleSend()} disabled={isSaving}>
                      <ButtonLabel icon="check">{isSaving ? 'Working...' : 'Send to Supplier'}</ButtonLabel>
                    </ThemedButton>
                  </>
                ) : null}
                {order.status !== 'cancelled' && order.status !== 'completed' ? (
                  <ThemedButton type="button" variant="secondary" onClick={() => setIsCancelOpen(true)} disabled={isSaving}>
                    <ButtonLabel icon="close">Cancel PO</ButtonLabel>
                  </ThemedButton>
                ) : null}
                <Link to={`/procurement?tab=receiving`} className="button-secondary">
                  <ButtonLabel icon="view">Receiving</ButtonLabel>
                </Link>
              </div>
            </>
          ) : null}
        </article>
      </section>

      {isCancelOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal procurement-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="terminal-modal__header">
              <h2>Cancel Purchase Order</h2>
            </header>
            <form className="terminal-modal__body" onSubmit={(event) => void handleCancel(event)}>
              <label className="field">
                <span>Reason</span>
                <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={4} required />
              </label>
              <footer className="terminal-modal__footer">
                <ThemedButton type="button" variant="secondary" onClick={() => setIsCancelOpen(false)}>
                  Close
                </ThemedButton>
                <ThemedButton type="submit" variant="primary" disabled={isSaving}>
                  Cancel PO
                </ThemedButton>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}

export default ProcurementOrderEditorPage
