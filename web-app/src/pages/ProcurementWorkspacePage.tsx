import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'
import {
  approveThreeWayMatch,
  createOrderFromPr,
  createReceivingReport,
  fetchOrder,
  createSupplier,
  fetchMatchingReport,
  fetchOrderReport,
  fetchOrders,
  fetchPayables,
  fetchPayablesAging,
  fetchReceivingReportList,
  fetchReceivingReports,
  fetchRequisitionReport,
  fetchRequisitions,
  fetchReorderAlerts,
  fetchSuppliers,
  formatMoney,
  formatProcurementDateTime,
  procurementStatusPillClass,
  recordPayment,
  runThreeWayMatch,
  updateSupplier,
  type MatchingReportRow,
  type OrderReport,
  type Payable,
  type PayablesAging,
  type PurchaseOrder,
  type PurchaseRequisition,
  type ReceivingReport,
  type ReorderAlert,
  type RequisitionReport,
  type Supplier,
} from '../lib/procurementApi'

type WorkspaceTab =
  | 'reorder-alerts'
  | 'requisitions'
  | 'orders'
  | 'receiving'
  | 'matching'
  | 'payables'
  | 'reports'
  | 'suppliers'

type ReportSubTab = 'requisitions' | 'orders' | 'receiving' | 'matching' | 'aging'

const WORKSPACE_TABS: WorkspaceTab[] = [
  'reorder-alerts',
  'requisitions',
  'orders',
  'receiving',
  'matching',
  'payables',
  'reports',
  'suppliers',
]

function isWorkspaceTab(value: string | null): value is WorkspaceTab {
  return WORKSPACE_TABS.includes(value as WorkspaceTab)
}

function tabLabel(tab: WorkspaceTab) {
  const labels: Record<WorkspaceTab, string> = {
    'reorder-alerts': 'Reorder Alerts',
    requisitions: 'Requisitions',
    orders: 'Orders',
    receiving: 'Receiving',
    matching: 'Matching',
    payables: 'Payables',
    reports: 'Reports',
    suppliers: 'Suppliers',
  }
  return labels[tab]
}

function emptySupplierForm(): Partial<Supplier> {
  return {
    supplier_name: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    payment_terms: 'Net 30',
    address: '',
    is_active: 1,
  }
}

function ProcurementWorkspacePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = useMemo<WorkspaceTab>(() => {
    const requested = searchParams.get('tab')
    return isWorkspaceTab(requested) ? requested : 'reorder-alerts'
  }, [searchParams])

  usePageVisitAudit(AUDIT_PAGES.PROCUREMENT)

  const [visitedTabs, setVisitedTabs] = useState<Set<WorkspaceTab>>(() => new Set([activeTab]))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [reorderAlerts, setReorderAlerts] = useState<ReorderAlert[]>([])
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [receivingReports, setReceivingReports] = useState<ReceivingReport[]>([])
  const [matchingRows, setMatchingRows] = useState<MatchingReportRow[]>([])
  const [payables, setPayables] = useState<Payable[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [prStatusFilter, setPrStatusFilter] = useState('')
  const [prSearchFilter, setPrSearchFilter] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('')
  const [orderSearchFilter, setOrderSearchFilter] = useState('')
  const [rrStatusFilter, setRrStatusFilter] = useState('')
  const [payableStatusFilter, setPayableStatusFilter] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showInactiveSuppliers, setShowInactiveSuppliers] = useState(false)

  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('requisitions')
  const [reportStatus, setReportStatus] = useState('')
  const [reportDateFrom, setReportDateFrom] = useState('')
  const [reportDateTo, setReportDateTo] = useState('')
  const [requisitionReport, setRequisitionReport] = useState<RequisitionReport | null>(null)
  const [orderReport, setOrderReport] = useState<OrderReport | null>(null)
  const [receivingReportRows, setReceivingReportRows] = useState<Array<Record<string, unknown>>>([])
  const [matchingReportRows, setMatchingReportRows] = useState<MatchingReportRow[]>([])
  const [payablesAging, setPayablesAging] = useState<PayablesAging | null>(null)

  const [createPoPrId, setCreatePoPrId] = useState('')
  const [createPoSupplierId, setCreatePoSupplierId] = useState('')
  const [isCreatePoOpen, setIsCreatePoOpen] = useState(false)

  const [newRrPoId, setNewRrPoId] = useState('')
  const [isNewRrOpen, setIsNewRrOpen] = useState(false)

  const [payModalPayable, setPayModalPayable] = useState<Payable | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('')
  const [payDate, setPayDate] = useState('')

  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>(emptySupplierForm())

  useEffect(() => {
    setVisitedTabs((current) => {
      if (current.has(activeTab)) {
        return current
      }
      const next = new Set(current)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  useEffect(() => {
    if (!visitedTabs.has(activeTab)) {
      return
    }
    void loadTabData(activeTab)
  }, [activeTab, visitedTabs])

  function handleTabChange(tab: WorkspaceTab) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next)
  }

  async function loadTabData(tab: WorkspaceTab) {
    try {
      setIsLoading(true)
      setError('')

      if (tab === 'reorder-alerts') {
        const response = await fetchReorderAlerts()
        setReorderAlerts(response.data || [])
      } else if (tab === 'requisitions') {
        await loadRequisitions()
      } else if (tab === 'orders') {
        await loadOrders()
      } else if (tab === 'receiving') {
        await loadReceiving()
      } else if (tab === 'matching') {
        const response = await fetchMatchingReport()
        setMatchingRows(response.data || [])
      } else if (tab === 'payables') {
        await loadPayables()
      } else if (tab === 'suppliers') {
        await loadSuppliers()
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load procurement data.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadRequisitions() {
    const response = await fetchRequisitions({
      status: prStatusFilter || undefined,
      search: prSearchFilter.trim() || undefined,
    })
    setRequisitions(response.data || [])
  }

  async function loadOrders() {
    const response = await fetchOrders({
      status: orderStatusFilter || undefined,
      search: orderSearchFilter.trim() || undefined,
    })
    setOrders(response.data || [])
  }

  async function loadReceiving() {
    const response = await fetchReceivingReports({
      status: rrStatusFilter || undefined,
    })
    setReceivingReports(response.data || [])
  }

  async function loadPayables() {
    const response = await fetchPayables({
      status: payableStatusFilter || undefined,
    })
    setPayables(response.data || [])
  }

  async function loadSuppliers() {
    const response = await fetchSuppliers({
      active_only: showInactiveSuppliers ? '0' : undefined,
      search: supplierSearch.trim() || undefined,
    })
    setSuppliers(response.data || [])
  }

  function handleCreatePrFromAlerts(selected: ReorderAlert[]) {
    const items = selected.map((row) => ({
      lookup: row.barcode,
      product_barcode: row.barcode,
      product_name: row.product_name,
      sku: row.sku,
      qty_requested: row.suggested_order_qty,
    }))
    const encoded = encodeURIComponent(JSON.stringify(items))
    navigate(`/procurement/requisitions/new?items=${encoded}`)
  }

  function handleCreatePrFromAllAlerts() {
    if (!reorderAlerts.length) {
      return
    }
    handleCreatePrFromAlerts(reorderAlerts)
  }

  async function handleCreatePoFromPr(event: FormEvent) {
    event.preventDefault()
    const prId = Number(createPoPrId)
    if (!prId) {
      setError('Select an approved requisition.')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      const response = await createOrderFromPr(prId, {
        supplier_id: createPoSupplierId ? Number(createPoSupplierId) : undefined,
      }, {
        page: AUDIT_PAGES.PROCUREMENT,
        action: 'INSERT',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT, `Created purchase order from PR #${prId}.`),
        tableName: 'purchase_orders',
      })
      setSuccess(response.message || 'Purchase order created.')
      setIsCreatePoOpen(false)
      navigate(`/procurement/orders/${response.data.id}`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create purchase order.')
    } finally {
      setIsSaving(false)
    }
  }

  async function openCreatePoModal() {
    try {
      setIsSaving(true)
      const [prResponse, supplierResponse] = await Promise.all([
        fetchRequisitions({ status: 'approved' }),
        fetchSuppliers(),
      ])
      setRequisitions(prResponse.data || [])
      setSuppliers(supplierResponse.data || [])
      setCreatePoPrId('')
      setCreatePoSupplierId('')
      setIsCreatePoOpen(true)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load approved requisitions.')
    } finally {
      setIsSaving(false)
    }
  }

  async function openNewRrModal() {
    try {
      setIsSaving(true)
      const response = await fetchOrders()
      const receivable = (response.data || []).filter((row) => ['sent', 'partially_received'].includes(row.status))
      setOrders(receivable)
      setNewRrPoId('')
      setIsNewRrOpen(true)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load purchase orders.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateReceivingReport(event: FormEvent) {
    event.preventDefault()
    const poId = Number(newRrPoId)
    if (!poId) {
      setError('Select a purchase order to receive against.')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      const detail = await fetchOrder(poId)
      const po = detail.data
      const items = (po.items || []).map((line) => ({
        purchase_order_item_id: line.id,
        product_name: line.product_name,
        sku: line.sku,
        product_barcode: line.product_barcode,
        qty_received: Math.max(line.qty_ordered - line.qty_received, 0) || line.qty_ordered,
        item_condition: 'good',
        expiry_date: null,
        batch_number: '',
      }))
      const response = await createReceivingReport(poId, { items }, {
        page: AUDIT_PAGES.PROCUREMENT,
        action: 'INSERT',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT, `Created receiving report for PO ${po.po_number}.`),
        tableName: 'receiving_reports',
      })
      setSuccess(response.message || 'Receiving report created.')
      setIsNewRrOpen(false)
      navigate(`/procurement/receiving/${response.data.id}`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create receiving report.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRunMatch(poId: number) {
    try {
      setIsSaving(true)
      setError('')
      const response = await runThreeWayMatch(poId, {
        page: AUDIT_PAGES.PROCUREMENT,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT, `Ran three-way match for PO #${poId}.`),
        tableName: 'three_way_matches',
      })
      setSuccess(response.message || 'Three-way match completed.')
      const list = await fetchMatchingReport()
      setMatchingRows(list.data || [])
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to run three-way match.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleApproveMatch(poId: number) {
    try {
      setIsSaving(true)
      setError('')
      const response = await approveThreeWayMatch(poId, {
        page: AUDIT_PAGES.PROCUREMENT,
        action: 'UPDATE',
        description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT, `Approved three-way match for PO #${poId}.`),
        tableName: 'three_way_matches',
      })
      setSuccess(response.message || 'Match approved for payment.')
      const list = await fetchMatchingReport()
      setMatchingRows(list.data || [])
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to approve match.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRecordPayment(event: FormEvent) {
    event.preventDefault()
    if (!payModalPayable) {
      return
    }

    try {
      setIsSaving(true)
      setError('')
      const response = await recordPayment(
        payModalPayable.id,
        {
          amount: Number(payAmount),
          payment_method: payMethod,
          payment_date: payDate || undefined,
        },
        {
          page: AUDIT_PAGES.PROCUREMENT,
          action: 'UPDATE',
          description: buildAuditDescription(AUDIT_PAGES.PROCUREMENT, `Recorded payment for payable #${payModalPayable.id}.`),
          tableName: 'accounts_payable',
        },
      )
      setSuccess(response.message || 'Payment recorded.')
      setPayModalPayable(null)
      await loadPayables()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to record payment.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLoadReports(event: FormEvent) {
    event.preventDefault()
    try {
      setIsLoading(true)
      setError('')
      const params = {
        status: reportStatus || undefined,
        date_from: reportDateFrom || undefined,
        date_to: reportDateTo || undefined,
      }

      if (reportSubTab === 'requisitions') {
        const response = await fetchRequisitionReport(params)
        setRequisitionReport(response.data)
      } else if (reportSubTab === 'orders') {
        const response = await fetchOrderReport(params)
        setOrderReport(response.data)
      } else if (reportSubTab === 'receiving') {
        const response = await fetchReceivingReportList(params)
        setReceivingReportRows(response.data || [])
      } else if (reportSubTab === 'matching') {
        const response = await fetchMatchingReport(params)
        setMatchingReportRows(response.data || [])
      } else {
        const response = await fetchPayablesAging()
        setPayablesAging(response.data)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load report.')
    } finally {
      setIsLoading(false)
    }
  }

  function openSupplierModal(supplier: Supplier | null) {
    setEditingSupplier(supplier)
    setSupplierForm(supplier ? { ...supplier } : emptySupplierForm())
    setSupplierModalOpen(true)
  }

  async function handleSaveSupplier(event: FormEvent) {
    event.preventDefault()
    try {
      setIsSaving(true)
      setError('')
      const audit = {
        page: AUDIT_PAGES.PROCUREMENT,
        action: editingSupplier ? 'UPDATE' : 'INSERT',
        description: buildAuditDescription(
          AUDIT_PAGES.PROCUREMENT,
          editingSupplier ? `Updated supplier ${supplierForm.supplier_name}.` : `Created supplier ${supplierForm.supplier_name}.`,
        ),
        tableName: 'suppliers',
      }

      if (editingSupplier) {
        const response = await updateSupplier(editingSupplier.id, supplierForm, audit)
        setSuccess(response.message || 'Supplier updated.')
      } else {
        const response = await createSupplier(supplierForm, audit)
        setSuccess(response.message || 'Supplier created.')
      }

      setSupplierModalOpen(false)
      await loadSuppliers()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save supplier.')
    } finally {
      setIsSaving(false)
    }
  }

  const approvedRequisitions = useMemo(
    () => requisitions.filter((row) => row.status === 'approved'),
    [requisitions],
  )

  return (
    <AdminShell
      title="Procurement"
      description="Manage purchase requisitions, orders, receiving, matching, payables, and suppliers."
      hideTopbar
    >
      <section className="settings-stack inventory-tabs-shell procurement-workspace-shell">
        <article className="surface-card surface-card--wide inventory-workspace-card procurement-workspace-card">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Procurement</p>
              <p className="audit-card-description">
                End-to-end procurement workflow from reorder alerts through supplier payments.
              </p>
            </div>
            <div className="audit-card-actions inventory-tabs-bar procurement-tabs-bar" role="tablist" aria-label="Procurement workspace tabs">
              {WORKSPACE_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  className={`inventory-tab-trigger${activeTab === tab ? ' is-active' : ''}`}
                  onClick={() => handleTabChange(tab)}
                >
                  <ButtonLabel icon={tab === 'reports' ? 'generate' : tab === 'suppliers' ? 'settings' : 'view'}>
                    {tabLabel(tab)}
                  </ButtonLabel>
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="form-message form-message--error">{error}</p> : null}
          {success ? <p className="form-message form-message--success">{success}</p> : null}

          {activeTab === 'reorder-alerts' ? (
            <>
              <div className="audit-filter-bar procurement-filter-bar">
                <ThemedButton type="button" variant="primary" onClick={() => handleCreatePrFromAllAlerts()} disabled={!reorderAlerts.length}>
                  <ButtonLabel icon="plus">Create PR from Alerts</ButtonLabel>
                </ThemedButton>
              </div>
              {isLoading ? <div className="empty-state">Loading reorder alerts...</div> : null}
              {!isLoading && reorderAlerts.length === 0 ? (
                <div className="empty-state">No products are currently at or below reorder point.</div>
              ) : null}
              {!isLoading && reorderAlerts.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Current Stock</th>
                        <th>ROP</th>
                        <th>Suggested Qty</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reorderAlerts.map((row) => (
                        <tr key={row.barcode}>
                          <td>{row.product_name}</td>
                          <td>{row.barcode}</td>
                          <td>{row.current_stock}</td>
                          <td>{row.rop}</td>
                          <td>{row.suggested_order_qty}</td>
                          <td>
                            <button type="button" className="button-secondary button-secondary--compact" onClick={() => handleCreatePrFromAlerts([row])}>
                              <ButtonLabel icon="plus">Create PR</ButtonLabel>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'requisitions' ? (
            <>
              <div className="audit-filter-bar procurement-filter-bar">
                <label className="field">
                  <span>Status</span>
                  <select value={prStatusFilter} onChange={(event) => setPrStatusFilter(event.target.value)}>
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label className="field">
                  <span>Search</span>
                  <input type="search" value={prSearchFilter} onChange={(event) => setPrSearchFilter(event.target.value)} placeholder="PR number or user" />
                </label>
                <button type="button" className="button-secondary audit-generate-button" onClick={() => void loadRequisitions()} disabled={isLoading}>
                  <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
                </button>
                <Link to="/procurement/requisitions/new" className="button-primary">
                  <ButtonLabel icon="plus">New PR</ButtonLabel>
                </Link>
              </div>
              {isLoading ? <div className="empty-state">Loading requisitions...</div> : null}
              {!isLoading && requisitions.length === 0 ? <div className="empty-state">No purchase requisitions found.</div> : null}
              {!isLoading && requisitions.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PR #</th>
                        <th>Status</th>
                        <th>Supplier</th>
                        <th>Items</th>
                        <th>Created By</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requisitions.map((row) => (
                        <tr key={row.id}>
                          <td>{row.pr_number}</td>
                          <td>
                            <span className={`status-pill status-pill--${procurementStatusPillClass(row.status)}`}>{row.status}</span>
                          </td>
                          <td>{row.preferred_supplier_name || ''}</td>
                          <td>{row.item_count}</td>
                          <td>{row.created_by_username || ''}</td>
                          <td>{formatProcurementDateTime(row.created_at)}</td>
                          <td>
                            <Link to={`/procurement/requisitions/${row.id}`} className="button-secondary button-secondary--compact">
                              <ButtonLabel icon="open">Open</ButtonLabel>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'orders' ? (
            <>
              <div className="audit-filter-bar procurement-filter-bar">
                <label className="field">
                  <span>Status</span>
                  <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}>
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="partially_received">Partially Received</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="field">
                  <span>Search</span>
                  <input type="search" value={orderSearchFilter} onChange={(event) => setOrderSearchFilter(event.target.value)} placeholder="PO, PR, or supplier" />
                </label>
                <button type="button" className="button-secondary audit-generate-button" onClick={() => void loadOrders()} disabled={isLoading}>
                  <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
                </button>
                <ThemedButton type="button" variant="primary" onClick={() => void openCreatePoModal()}>
                  <ButtonLabel icon="plus">Create PO from PR</ButtonLabel>
                </ThemedButton>
              </div>
              {isLoading ? <div className="empty-state">Loading purchase orders...</div> : null}
              {!isLoading && orders.length === 0 ? <div className="empty-state">No purchase orders found.</div> : null}
              {!isLoading && orders.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PO #</th>
                        <th>PR #</th>
                        <th>Supplier</th>
                        <th>Status</th>
                        <th>Items</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((row) => (
                        <tr key={row.id}>
                          <td>{row.po_number}</td>
                          <td>{row.pr_number || ''}</td>
                          <td>{row.supplier_name || ''}</td>
                          <td>
                            <span className={`status-pill status-pill--${procurementStatusPillClass(row.status)}`}>{row.status}</span>
                          </td>
                          <td>{row.item_count}</td>
                          <td>{formatProcurementDateTime(row.created_at)}</td>
                          <td>
                            <Link to={`/procurement/orders/${row.id}`} className="button-secondary button-secondary--compact">
                              <ButtonLabel icon="open">Open</ButtonLabel>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'receiving' ? (
            <>
              <div className="audit-filter-bar procurement-filter-bar">
                <label className="field">
                  <span>Status</span>
                  <select value={rrStatusFilter} onChange={(event) => setRrStatusFilter(event.target.value)}>
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </label>
                <button type="button" className="button-secondary audit-generate-button" onClick={() => void loadReceiving()} disabled={isLoading}>
                  <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
                </button>
                <ThemedButton type="button" variant="primary" onClick={() => void openNewRrModal()}>
                  <ButtonLabel icon="plus">New RR</ButtonLabel>
                </ThemedButton>
              </div>
              {isLoading ? <div className="empty-state">Loading receiving reports...</div> : null}
              {!isLoading && receivingReports.length === 0 ? <div className="empty-state">No receiving reports found.</div> : null}
              {!isLoading && receivingReports.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>RR #</th>
                        <th>PO #</th>
                        <th>Status</th>
                        <th>DR #</th>
                        <th>Items</th>
                        <th>Received At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivingReports.map((row) => (
                        <tr key={row.id}>
                          <td>{row.rr_number}</td>
                          <td>{row.po_number || ''}</td>
                          <td>
                            <span className={`status-pill status-pill--${procurementStatusPillClass(row.status)}`}>{row.status}</span>
                          </td>
                          <td>{row.supplier_dr_number || ''}</td>
                          <td>{row.item_count}</td>
                          <td>{formatProcurementDateTime(row.received_at)}</td>
                          <td>
                            <Link to={`/procurement/receiving/${row.id}`} className="button-secondary button-secondary--compact">
                              <ButtonLabel icon="open">Open</ButtonLabel>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'matching' ? (
            <>
              {isLoading ? <div className="empty-state">Loading matching records...</div> : null}
              {!isLoading && matchingRows.length === 0 ? <div className="empty-state">No three-way match records yet. Run match from a purchase order.</div> : null}
              {!isLoading && matchingRows.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PO #</th>
                        <th>Status</th>
                        <th>Reviewed By</th>
                        <th>Updated At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.po_number || row.purchase_order_id}</td>
                          <td>
                            <span className={`status-pill status-pill--${procurementStatusPillClass(row.status)}`}>{row.status}</span>
                          </td>
                          <td>{row.reviewed_by_username || ''}</td>
                          <td>{formatProcurementDateTime(row.updated_at || null)}</td>
                          <td className="procurement-row-actions">
                            <button type="button" className="button-secondary button-secondary--compact" onClick={() => void handleRunMatch(row.purchase_order_id)} disabled={isSaving}>
                              <ButtonLabel icon="sync">Run Match</ButtonLabel>
                            </button>
                            <button
                              type="button"
                              className="button-primary button-secondary--compact"
                              onClick={() => void handleApproveMatch(row.purchase_order_id)}
                              disabled={isSaving || row.status === 'discrepancy'}
                            >
                              <ButtonLabel icon="check">Approve</ButtonLabel>
                            </button>
                            <Link to={`/procurement/orders/${row.purchase_order_id}`} className="button-secondary button-secondary--compact">
                              <ButtonLabel icon="open">PO</ButtonLabel>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'payables' ? (
            <>
              <div className="audit-filter-bar procurement-filter-bar">
                <label className="field">
                  <span>Status</span>
                  <select value={payableStatusFilter} onChange={(event) => setPayableStatusFilter(event.target.value)}>
                    <option value="">All</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </label>
                <button type="button" className="button-secondary audit-generate-button" onClick={() => void loadPayables()} disabled={isLoading}>
                  <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
                </button>
              </div>
              {isLoading ? <div className="empty-state">Loading payables...</div> : null}
              {!isLoading && payables.length === 0 ? <div className="empty-state">No accounts payable records found.</div> : null}
              {!isLoading && payables.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PO #</th>
                        <th>Supplier</th>
                        <th>Status</th>
                        <th>Due</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payables.map((row) => (
                        <tr key={row.id}>
                          <td>{row.po_number || ''}</td>
                          <td>{row.supplier_name || ''}</td>
                          <td>
                            <span className={`status-pill status-pill--${procurementStatusPillClass(row.status)}`}>{row.status}</span>
                          </td>
                          <td>{formatMoney(row.amount_due)}</td>
                          <td>{formatMoney(row.amount_paid)}</td>
                          <td>{formatMoney(row.balance)}</td>
                          <td>
                            {row.status !== 'paid' ? (
                              <button
                                type="button"
                                className="button-primary button-secondary--compact"
                                onClick={() => {
                                  setPayModalPayable(row)
                                  setPayAmount(String(row.balance))
                                  setPayMethod('')
                                  setPayDate(new Date().toISOString().slice(0, 10))
                                }}
                              >
                                <ButtonLabel icon="check">Pay</ButtonLabel>
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'reports' ? (
            <>
              <div className="procurement-report-tabs" role="tablist" aria-label="Procurement report types">
                {(['requisitions', 'orders', 'receiving', 'matching', 'aging'] as ReportSubTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={reportSubTab === tab}
                    className={`inventory-tab-trigger procurement-report-tab${reportSubTab === tab ? ' is-active' : ''}`}
                    onClick={() => setReportSubTab(tab)}
                  >
                    {tab === 'aging' ? 'Payables Aging' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <form className="audit-filter-bar procurement-filter-bar" onSubmit={(event) => void handleLoadReports(event)}>
                {reportSubTab !== 'aging' ? (
                  <>
                    <label className="field">
                      <span>Status</span>
                      <input type="text" value={reportStatus} onChange={(event) => setReportStatus(event.target.value)} placeholder="Optional" />
                    </label>
                    <label className="field">
                      <span>Date From</span>
                      <input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Date To</span>
                      <input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} />
                    </label>
                  </>
                ) : null}
                <button type="submit" className="button-primary audit-generate-button" disabled={isLoading}>
                  <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Run Report'}</ButtonLabel>
                </button>
              </form>

              {reportSubTab === 'requisitions' && requisitionReport ? (
                <div className="procurement-report-panel">
                  <div className="procurement-report-summary">
                    {requisitionReport.summary.map((row) => (
                      <article key={row.status} className="procurement-report-card">
                        <strong>{row.status}</strong>
                        <span>{row.count} records</span>
                      </article>
                    ))}
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>PR #</th>
                          <th>Status</th>
                          <th>Product</th>
                          <th>Barcode</th>
                          <th>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requisitionReport.details.map((row, index) => (
                          <tr key={`${row.id}-${row.product_barcode || index}`}>
                            <td>{row.pr_number}</td>
                            <td>{row.status}</td>
                            <td>{row.product_name || ''}</td>
                            <td>{row.product_barcode || ''}</td>
                            <td>{row.qty_requested ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {reportSubTab === 'orders' && orderReport ? (
                <div className="procurement-report-panel">
                  <div className="procurement-report-summary">
                    {orderReport.summary.map((row) => (
                      <article key={row.status} className="procurement-report-card">
                        <strong>{row.status}</strong>
                        <span>{row.count} orders</span>
                        <span>{formatMoney(row.total_value)}</span>
                      </article>
                    ))}
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>PO #</th>
                          <th>Supplier</th>
                          <th>Product</th>
                          <th>Ordered</th>
                          <th>Received</th>
                          <th>Unit Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderReport.details.map((row, index) => (
                          <tr key={`${row.id}-${row.product_barcode || index}`}>
                            <td>{row.po_number}</td>
                            <td>{row.supplier_name || ''}</td>
                            <td>{row.product_name || ''}</td>
                            <td>{row.qty_ordered ?? ''}</td>
                            <td>{row.qty_received ?? ''}</td>
                            <td>{row.unit_cost != null ? formatMoney(row.unit_cost) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {reportSubTab === 'receiving' && receivingReportRows.length > 0 ? (
                <div className="table-wrap procurement-report-panel">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>RR #</th>
                        <th>PO #</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivingReportRows.map((row, index) => (
                        <tr key={`${String(row.id)}-${index}`}>
                          <td>{String(row.rr_number || '')}</td>
                          <td>{String(row.po_number || '')}</td>
                          <td>{String(row.product_name || '')}</td>
                          <td>{String(row.qty_received || '')}</td>
                          <td>{String(row.item_condition || '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {reportSubTab === 'matching' && matchingReportRows.length > 0 ? (
                <div className="table-wrap procurement-report-panel">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PO #</th>
                        <th>Status</th>
                        <th>Reviewed By</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingReportRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.po_number || row.purchase_order_id}</td>
                          <td>{row.status}</td>
                          <td>{row.reviewed_by_username || ''}</td>
                          <td>{formatProcurementDateTime(row.updated_at || null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {reportSubTab === 'aging' && payablesAging ? (
                <div className="procurement-report-panel">
                  <div className="procurement-report-summary">
                    <article className="procurement-report-card">
                      <strong>Total Outstanding</strong>
                      <span>{formatMoney(payablesAging.summary.total_outstanding)}</span>
                    </article>
                    <article className="procurement-report-card">
                      <strong>Current</strong>
                      <span>{formatMoney(payablesAging.summary.current)}</span>
                    </article>
                    <article className="procurement-report-card">
                      <strong>1-30 Days</strong>
                      <span>{formatMoney(payablesAging.summary.days_1_30)}</span>
                    </article>
                    <article className="procurement-report-card">
                      <strong>31-60 Days</strong>
                      <span>{formatMoney(payablesAging.summary.days_31_60)}</span>
                    </article>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'suppliers' ? (
            <>
              <div className="audit-filter-bar procurement-filter-bar">
                <label className="field">
                  <span>Search</span>
                  <input type="search" value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Name, contact, email" />
                </label>
                <label className="field procurement-checkbox-field">
                  <input type="checkbox" checked={showInactiveSuppliers} onChange={(event) => setShowInactiveSuppliers(event.target.checked)} />
                  <span>Show inactive</span>
                </label>
                <button type="button" className="button-secondary audit-generate-button" onClick={() => void loadSuppliers()} disabled={isLoading}>
                  <ButtonLabel icon="generate">{isLoading ? 'Loading...' : 'Generate'}</ButtonLabel>
                </button>
                <ThemedButton type="button" variant="primary" onClick={() => openSupplierModal(null)}>
                  <ButtonLabel icon="plus">Add Supplier</ButtonLabel>
                </ThemedButton>
              </div>
              {isLoading ? <div className="empty-state">Loading suppliers...</div> : null}
              {!isLoading && suppliers.length === 0 ? <div className="empty-state">No suppliers found.</div> : null}
              {!isLoading && suppliers.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Phone</th>
                        <th>Terms</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((row) => (
                        <tr key={row.id}>
                          <td>{row.supplier_name}</td>
                          <td>{row.contact_person || ''}</td>
                          <td>{row.contact_phone || ''}</td>
                          <td>{row.payment_terms || ''}</td>
                          <td>
                            <span className={`status-pill status-pill--${row.is_active ? 'success' : 'pending'}`}>
                              {row.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button type="button" className="button-secondary button-secondary--compact" onClick={() => openSupplierModal(row)}>
                              <ButtonLabel icon="edit">Edit</ButtonLabel>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </article>
      </section>

      {isCreatePoOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal procurement-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="terminal-modal__header">
              <h2>Create Purchase Order</h2>
              <p>Select an approved purchase requisition.</p>
            </header>
            <form className="terminal-modal__body" onSubmit={(event) => void handleCreatePoFromPr(event)}>
              <label className="field">
                <span>Approved PR</span>
                <select value={createPoPrId} onChange={(event) => setCreatePoPrId(event.target.value)} required>
                  <option value="">Select requisition</option>
                  {approvedRequisitions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.pr_number} ({row.item_count} items)
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Supplier override</span>
                <select value={createPoSupplierId} onChange={(event) => setCreatePoSupplierId(event.target.value)}>
                  <option value="">Use PR preferred supplier</option>
                  {suppliers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.supplier_name}
                    </option>
                  ))}
                </select>
              </label>
              <footer className="terminal-modal__footer">
                <ThemedButton type="button" variant="secondary" onClick={() => setIsCreatePoOpen(false)}>
                  Cancel
                </ThemedButton>
                <ThemedButton type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? 'Creating...' : 'Create PO'}
                </ThemedButton>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {isNewRrOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal procurement-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="terminal-modal__header">
              <h2>New Receiving Report</h2>
              <p>Select a sent or partially received purchase order.</p>
            </header>
            <form className="terminal-modal__body" onSubmit={(event) => void handleCreateReceivingReport(event)}>
              <label className="field">
                <span>Purchase Order</span>
                <select value={newRrPoId} onChange={(event) => setNewRrPoId(event.target.value)} required>
                  <option value="">Select PO</option>
                  {orders.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.po_number} · {row.supplier_name || 'Supplier'} · {row.status}
                    </option>
                  ))}
                </select>
              </label>
              <footer className="terminal-modal__footer">
                <ThemedButton type="button" variant="secondary" onClick={() => setIsNewRrOpen(false)}>
                  Cancel
                </ThemedButton>
                <ThemedButton type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? 'Creating...' : 'Create RR'}
                </ThemedButton>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {payModalPayable ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal procurement-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="terminal-modal__header">
              <h2>Record Payment</h2>
              <p>
                PO {payModalPayable.po_number} · Balance {formatMoney(payModalPayable.balance)}
              </p>
            </header>
            <form className="terminal-modal__body" onSubmit={(event) => void handleRecordPayment(event)}>
              <label className="field">
                <span>Amount</span>
                <input type="number" min="0.01" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} required />
              </label>
              <label className="field">
                <span>Payment Method</span>
                <input type="text" value={payMethod} onChange={(event) => setPayMethod(event.target.value)} />
              </label>
              <label className="field">
                <span>Payment Date</span>
                <input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} />
              </label>
              <footer className="terminal-modal__footer">
                <ThemedButton type="button" variant="secondary" onClick={() => setPayModalPayable(null)}>
                  Cancel
                </ThemedButton>
                <ThemedButton type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Record Payment'}
                </ThemedButton>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {supplierModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal procurement-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="terminal-modal__header">
              <h2>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
            </header>
            <form className="terminal-modal__body" onSubmit={(event) => void handleSaveSupplier(event)}>
              <label className="field">
                <span>Name</span>
                <input type="text" value={supplierForm.supplier_name || ''} onChange={(event) => setSupplierForm((current) => ({ ...current, supplier_name: event.target.value }))} required />
              </label>
              <label className="field">
                <span>Contact Person</span>
                <input type="text" value={supplierForm.contact_person || ''} onChange={(event) => setSupplierForm((current) => ({ ...current, contact_person: event.target.value }))} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input type="text" value={supplierForm.contact_phone || ''} onChange={(event) => setSupplierForm((current) => ({ ...current, contact_phone: event.target.value }))} />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={supplierForm.contact_email || ''} onChange={(event) => setSupplierForm((current) => ({ ...current, contact_email: event.target.value }))} />
              </label>
              <label className="field">
                <span>Payment Terms</span>
                <input type="text" value={supplierForm.payment_terms || ''} onChange={(event) => setSupplierForm((current) => ({ ...current, payment_terms: event.target.value }))} />
              </label>
              <label className="field">
                <span>Address</span>
                <textarea value={supplierForm.address || ''} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} rows={3} />
              </label>
              {editingSupplier ? (
                <label className="field procurement-checkbox-field">
                  <input
                    type="checkbox"
                    checked={Boolean(supplierForm.is_active)}
                    onChange={(event) => setSupplierForm((current) => ({ ...current, is_active: event.target.checked ? 1 : 0 }))}
                  />
                  <span>Active</span>
                </label>
              ) : null}
              <footer className="terminal-modal__footer">
                <ThemedButton type="button" variant="secondary" onClick={() => setSupplierModalOpen(false)}>
                  Cancel
                </ThemedButton>
                <ThemedButton type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Supplier'}
                </ThemedButton>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}

export default ProcurementWorkspacePage
