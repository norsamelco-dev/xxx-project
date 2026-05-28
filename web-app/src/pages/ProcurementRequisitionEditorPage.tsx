import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { useAuth } from '../context/AuthContext'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'
import {
  approveRequisition,
  createRequisition,
  deleteRequisition,
  fetchRequisition,
  fetchSuppliers,
  formatProcurementDateTime,
  procurementStatusPillClass,
  rejectRequisition,
  resubmitRequisition,
  submitRequisition,
  updateRequisition,
  type PurchaseRequisition,
  type PurchaseRequisitionItem,
  type Supplier,
} from '../lib/procurementApi'

type ProductRow = {
  product_id: number
  product_barcode: string | null
  product_name: string | null
  unit: string | null
  sku?: string
}

type ProductsResponse = {
  data: ProductRow[]
}

type DraftItem = PurchaseRequisitionItem & { key: string }

function newItemKey() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parsePrefillItems(raw: string | null): DraftItem[] {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as PurchaseRequisitionItem[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map((item) => ({
      ...item,
      key: newItemKey(),
      qty_requested: Number(item.qty_requested || 1),
    }))
  } catch (_error) {
    return []
  }
}

function ProcurementRequisitionEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const isNew = id === 'new'
  const requisitionId = isNew ? null : Number(id)

  usePageVisitAudit(AUDIT_PAGES.PROCUREMENT_REQUISITION)

  const barcodeRef = useRef<HTMLInputElement>(null)
  const [requisition, setRequisition] = useState<PurchaseRequisition | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [catalogProducts, setCatalogProducts] = useState<ProductRow[]>([])
  const [items, setItems] = useState<DraftItem[]>(() => parsePrefillItems(searchParams.get('items')))
  const [preferredSupplierId, setPreferredSupplierId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isApprover = user?.role === 'Admin' || user?.role === 'Manager'
  const canEdit = isNew || Boolean(requisition && requisition.status === 'draft')

  const auditMeta = useMemo(
    () => ({
      page: AUDIT_PAGES.PROCUREMENT_REQUISITION,
      tableName: 'purchase_requisitions',
    }),
    [],
  )

  useEffect(() => {
    void loadPageData()
  }, [id])

  async function loadPageData() {
    try {
      setIsLoading(true)
      setError('')

      const supplierResponse = await fetchSuppliers()
      setSuppliers(supplierResponse.data || [])

      if (isNew) {
        await loadCatalogProducts()
        return
      }

      if (!requisitionId || Number.isNaN(requisitionId)) {
        setError('Invalid requisition id.')
        return
      }

      const response = await fetchRequisition(requisitionId)
      setRequisition(response.data)
      setPreferredSupplierId(response.data.preferred_supplier_id ? String(response.data.preferred_supplier_id) : '')
      setRemarks(response.data.remarks || '')
      setItems(
        (response.data.items || []).map((item) => ({
          ...item,
          key: String(item.id || newItemKey()),
        })),
      )

      if (response.data.status === 'draft') {
        await loadCatalogProducts()
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load purchase requisition.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadCatalogProducts() {
    try {
      const response = await apiFetch<ProductsResponse>('/api/products')
      setCatalogProducts(response.data || [])
    } catch (_error) {
      setCatalogProducts([])
    }
  }

  function findProductByBarcode(barcode: string) {
    const normalized = barcode.trim().toLowerCase()
    return catalogProducts.find((row) => String(row.product_barcode || '').trim().toLowerCase() === normalized)
  }

  function handleAddByBarcode(event: FormEvent) {
    event.preventDefault()
    const barcode = barcodeInput.trim()
    if (!barcode) {
      return
    }

    const product = findProductByBarcode(barcode)
    if (!product) {
      setError(`No product found for barcode ${barcode}.`)
      return
    }

    setItems((current) => [
      ...current,
      {
        key: newItemKey(),
        product_id: product.product_id,
        product_name: String(product.product_name || ''),
        sku: String(product.product_barcode || ''),
        product_barcode: String(product.product_barcode || ''),
        qty_requested: 1,
        unit_snapshot: product.unit || '',
        lookup: String(product.product_barcode || ''),
      },
    ])
    setBarcodeInput('')
    setError('')
    barcodeRef.current?.focus()
  }

  function updateItemQty(key: string, qty: string) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, qty_requested: Number(qty) || 0 } : item)),
    )
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key))
  }

  function buildPayloadItems() {
    return items.map((item) => ({
      lookup: item.lookup || item.product_barcode,
      product_barcode: item.product_barcode,
      product_name: item.product_name,
      sku: item.sku,
      qty_requested: item.qty_requested,
      unit_snapshot: item.unit_snapshot,
    }))
  }

  async function handleSaveDraft() {
    if (!items.length) {
      setError('Add at least one line item.')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      const payload = {
        preferred_supplier_id: preferredSupplierId ? Number(preferredSupplierId) : null,
        remarks,
        items: buildPayloadItems(),
      }

      if (isNew) {
        const response = await createRequisition(payload, {
          ...auditMeta,
          action: 'INSERT',
          description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, 'Created draft purchase requisition.'),
        })
        setSuccess(response.message || 'Purchase requisition created.')
        navigate(`/procurement/requisitions/${response.data.id}`, { replace: true })
        return
      }

      const response = await updateRequisition(requisitionId!, payload, {
        ...auditMeta,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, `Updated PR ${requisition?.pr_number || requisitionId}.`),
      })
      setRequisition(response.data)
      setSuccess(response.message || 'Purchase requisition saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save purchase requisition.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit() {
    if (!items.length) {
      setError('Add at least one line item.')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      const payload = {
        preferred_supplier_id: preferredSupplierId ? Number(preferredSupplierId) : null,
        remarks,
        items: buildPayloadItems(),
      }

      let targetId = requisitionId

      if (isNew) {
        const created = await createRequisition(payload, {
          ...auditMeta,
          action: 'INSERT',
          description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, 'Created and submitted purchase requisition.'),
        })
        targetId = created.data.id
        setRequisition(created.data)
      } else if (canEdit) {
        const updated = await updateRequisition(requisitionId!, payload, {
          ...auditMeta,
          action: 'UPDATE',
          description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, `Updated PR ${requisition?.pr_number || requisitionId} before submit.`),
        })
        targetId = updated.data.id
        setRequisition(updated.data)
      }

      if (!targetId) {
        return
      }

      const response = await submitRequisition(targetId, {
        ...auditMeta,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, `Submitted PR ${requisition?.pr_number || targetId}.`),
      })
      setRequisition(response.data)
      setSuccess(response.message || 'Requisition submitted.')
      if (isNew) {
        navigate(`/procurement/requisitions/${targetId}`, { replace: true })
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to submit requisition.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleApprove() {
    if (!requisitionId) {
      return
    }

    try {
      setIsSaving(true)
      const response = await approveRequisition(requisitionId, {
        ...auditMeta,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, `Approved PR ${requisition?.pr_number}.`),
      })
      setRequisition(response.data)
      setSuccess(response.message || 'Requisition approved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to approve requisition.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReject(event: FormEvent) {
    event.preventDefault()
    if (!requisitionId || !rejectReason.trim()) {
      setError('Rejection reason is required.')
      return
    }

    try {
      setIsSaving(true)
      const response = await rejectRequisition(requisitionId, rejectReason.trim(), {
        ...auditMeta,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, `Rejected PR ${requisition?.pr_number}.`),
      })
      setRequisition(response.data)
      setSuccess(response.message || 'Requisition rejected.')
      setIsRejectOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to reject requisition.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResubmit() {
    if (!requisitionId) {
      return
    }

    try {
      setIsSaving(true)
      const response = await resubmitRequisition(requisitionId, {
        ...auditMeta,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, `Moved PR ${requisition?.pr_number} back to draft.`),
      })
      setRequisition(response.data)
      setSuccess(response.message || 'Requisition moved to draft.')
      await loadCatalogProducts()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to resubmit requisition.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!requisitionId) {
      return
    }

    if (!window.confirm('Delete this draft purchase requisition?')) {
      return
    }

    try {
      setIsSaving(true)
      await deleteRequisition(requisitionId, {
        ...auditMeta,
        action: 'DELETE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT_REQUISITION, `Deleted PR ${requisition?.pr_number}.`),
      })
      navigate('/procurement?tab=requisitions')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to delete requisition.')
    } finally {
      setIsSaving(false)
    }
  }

  const title = isNew ? 'New Purchase Requisition' : requisition?.pr_number || 'Purchase Requisition'

  return (
    <AdminShell title={title} description="Draft, submit, and approve purchase requisitions." hideTopbar>
      <section className="settings-stack procurement-editor-shell">
        <article className="surface-card surface-card--wide procurement-editor-card">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">
                <Link to="/procurement?tab=requisitions">Procurement</Link> / {title}
              </p>
              {!isNew && requisition ? (
                <p className="audit-card-description">
                  <span className={`status-pill status-pill--${procurementStatusPillClass(requisition.status)}`}>{requisition.status}</span>
                  {requisition.rejection_reason ? ` · ${requisition.rejection_reason}` : ''}
                </p>
              ) : (
                <p className="audit-card-description">Create a draft requisition and submit for approval.</p>
              )}
            </div>
            <Link to="/procurement?tab=requisitions" className="button-secondary">
              <ButtonLabel icon="back">Back to List</ButtonLabel>
            </Link>
          </div>

          {error ? <p className="form-message form-message--error">{error}</p> : null}
          {success ? <p className="form-message form-message--success">{success}</p> : null}
          {isLoading ? <div className="empty-state">Loading purchase requisition...</div> : null}

          {!isLoading ? (
            <>
              {!isNew && requisition ? (
                <div className="procurement-meta-grid">
                  <div>
                    <strong>Created By</strong>
                    <span>{requisition.created_by_username || ''}</span>
                  </div>
                  <div>
                    <strong>Created At</strong>
                    <span>{formatProcurementDateTime(requisition.created_at)}</span>
                  </div>
                  <div>
                    <strong>Submitted</strong>
                    <span>{formatProcurementDateTime(requisition.submitted_at)}</span>
                  </div>
                  <div>
                    <strong>Approved</strong>
                    <span>{formatProcurementDateTime(requisition.approved_at)}</span>
                  </div>
                </div>
              ) : null}

              <div className="procurement-form-grid">
                <label className="field">
                  <span>Preferred Supplier</span>
                  <select value={preferredSupplierId} onChange={(event) => setPreferredSupplierId(event.target.value)} disabled={!canEdit}>
                    <option value="">None</option>
                    {suppliers.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.supplier_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field procurement-form-grid__wide">
                  <span>Remarks</span>
                  <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} disabled={!canEdit} />
                </label>
              </div>

              {canEdit ? (
                <form className="procurement-barcode-form" onSubmit={handleAddByBarcode}>
                  <label className="field procurement-barcode-form__input">
                    <span>Add by Barcode</span>
                    <input
                      ref={barcodeRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(event) => setBarcodeInput(event.target.value)}
                      placeholder="Scan or type barcode"
                    />
                  </label>
                  <ThemedButton type="submit" variant="primary">
                    <ButtonLabel icon="plus">Add Line</ButtonLabel>
                  </ThemedButton>
                </form>
              ) : null}

              <div className="table-wrap procurement-items-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Barcode</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      {canEdit ? <th>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key}>
                        <td>{item.product_name}</td>
                        <td>{item.product_barcode}</td>
                        <td>
                          {canEdit ? (
                            <input
                              type="number"
                              min="1"
                              value={item.qty_requested}
                              onChange={(event) => updateItemQty(item.key, event.target.value)}
                            />
                          ) : (
                            item.qty_requested
                          )}
                        </td>
                        <td>{item.unit_snapshot || ''}</td>
                        {canEdit ? (
                          <td>
                            <button type="button" className="button-secondary button-secondary--compact" onClick={() => removeItem(item.key)}>
                              <ButtonLabel icon="delete">Remove</ButtonLabel>
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!items.length ? <div className="empty-state">No line items yet.</div> : null}
              </div>

              <div className="procurement-editor-actions">
                {canEdit ? (
                  <>
                    <ThemedButton type="button" variant="secondary" onClick={() => void handleSaveDraft()} disabled={isSaving}>
                      <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Save Draft'}</ButtonLabel>
                    </ThemedButton>
                    <ThemedButton type="button" variant="primary" onClick={() => void handleSubmit()} disabled={isSaving}>
                      <ButtonLabel icon="check">{isSaving ? 'Working...' : 'Submit'}</ButtonLabel>
                    </ThemedButton>
                    {!isNew ? (
                      <ThemedButton type="button" variant="secondary" onClick={() => void handleDelete()} disabled={isSaving}>
                        <ButtonLabel icon="delete">Delete</ButtonLabel>
                      </ThemedButton>
                    ) : null}
                  </>
                ) : null}

                {requisition?.status === 'submitted' && isApprover ? (
                  <>
                    <ThemedButton type="button" variant="primary" onClick={() => void handleApprove()} disabled={isSaving}>
                      <ButtonLabel icon="check">Approve</ButtonLabel>
                    </ThemedButton>
                    <ThemedButton type="button" variant="secondary" onClick={() => setIsRejectOpen(true)} disabled={isSaving}>
                      <ButtonLabel icon="close">Reject</ButtonLabel>
                    </ThemedButton>
                  </>
                ) : null}

                {requisition?.status === 'rejected' ? (
                  <ThemedButton type="button" variant="secondary" onClick={() => void handleResubmit()} disabled={isSaving}>
                    <ButtonLabel icon="sync">Resubmit to Draft</ButtonLabel>
                  </ThemedButton>
                ) : null}
              </div>
            </>
          ) : null}
        </article>
      </section>

      {isRejectOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal procurement-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="terminal-modal__header">
              <h2>Reject Requisition</h2>
            </header>
            <form className="terminal-modal__body" onSubmit={(event) => void handleReject(event)}>
              <label className="field">
                <span>Reason</span>
                <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={4} required />
              </label>
              <footer className="terminal-modal__footer">
                <ThemedButton type="button" variant="secondary" onClick={() => setIsRejectOpen(false)}>
                  Cancel
                </ThemedButton>
                <ThemedButton type="submit" variant="primary" disabled={isSaving}>
                  Reject
                </ThemedButton>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}

export default ProcurementRequisitionEditorPage
