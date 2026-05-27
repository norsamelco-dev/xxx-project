import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { ThemedButton } from '../components/ThemedButton'
import { ThemedDataGrid } from '../components/ThemedDataGrid'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription, recordAuditEvent } from '../lib/audit'

type ProductRow = {
  product_id: number
  product_barcode: string | null
  product_name: string | null
  category: string | null
  brand: string | null
  product_image_path: string | null
  qty: number | null
  unit: string | null
  rop: number | null
  created_at: string | null
}

type ProductForm = {
  product_barcode: string
  product_name: string
  category: string
  brand: string
  product_image_path: string | null
  product_image_file: File | null
  unit: string
  rop: string
}

type ProductsResponse = {
  data: ProductRow[]
  categories: string[]
  brands: string[]
  units: string[]
}

type BarcodeExistsResponse = {
  exists: boolean
}

type ProductSyncHistoryRow = {
  id: number
  sync_code: string | null
  sync_timestamp: string | null
  user_id: string | null
  username: string | null
  product_barcode: string | null
  batch_id: string | null
  qty_before: number
  qty_added: number
  qty_after: number
  cost_price: number | null
  selling_price: number | null
}

type ProductSyncHistoryResponse = {
  data: ProductSyncHistoryRow[]
}

type BarcodeCheckState = 'idle' | 'checking' | 'available' | 'duplicate' | 'error'

const allowedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const maxProductImageBytes = 4 * 1024 * 1024

const initialForm: ProductForm = {
  product_barcode: '',
  product_name: '',
  category: '',
  brand: '',
  product_image_path: null,
  product_image_file: null,
  unit: '',
  rop: '20',
}

function toFormValue(value: number | null) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function toInputDateTime(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString()
}

function toMoney(value: number | null) {
  if (value === null || value === undefined) {
    return ''
  }

  return Number(value).toFixed(2)
}

function mapRowToForm(row: ProductRow): ProductForm {
  return {
    product_barcode: row.product_barcode || '',
    product_name: row.product_name || '',
    category: row.category || '',
    brand: row.brand || '',
    product_image_path: row.product_image_path || null,
    product_image_file: null,
    unit: row.unit || '',
    rop: toFormValue(row.rop),
  }
}

type ProductsPageProps = {
  embedded?: boolean
}

function ProductsPage({ embedded = false }: ProductsPageProps) {
  const location = useLocation()
  const navigate = useNavigate()
  usePageVisitAudit(AUDIT_PAGES.INVENTORY_PRODUCTS)
  const [rows, setRows] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [form, setForm] = useState<ProductForm>(initialForm)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [barcodeCheckState, setBarcodeCheckState] = useState<BarcodeCheckState>('idle')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [isSyncHistoryModalOpen, setIsSyncHistoryModalOpen] = useState(false)
  const [isLoadingSyncHistory, setIsLoadingSyncHistory] = useState(false)
  const [isExportingSyncHistory, setIsExportingSyncHistory] = useState(false)
  const [syncHistoryProduct, setSyncHistoryProduct] = useState<ProductRow | null>(null)
  const [syncHistoryRows, setSyncHistoryRows] = useState<ProductSyncHistoryRow[]>([])
  const [newImagePreviewUrl, setNewImagePreviewUrl] = useState('')
  const [previewImageSrc, setPreviewImageSrc] = useState('')
  const [previewImageAlt, setPreviewImageAlt] = useState('Product image preview')
  const [isImageDragOver, setIsImageDragOver] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadRows()
  }, [])

  useEffect(() => {
    const modalState = location.state as { openAddProductModal?: boolean; prefillBarcode?: string } | null

    if (!modalState?.openAddProductModal) {
      return
    }

    handleAddNew(modalState.prefillBarcode || '')
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!form.product_image_file) {
      setNewImagePreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(form.product_image_file)
    setNewImagePreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [form.product_image_file])

  async function loadRows() {
    try {
      setError('')
      setIsLoading(true)
      const response = await apiFetch<ProductsResponse>('/api/products')
      setRows(response.data || [])
      setCategories(response.categories || [])
      setBrands(response.brands || [])
      setUnits(response.units || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load products.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleAddNew(prefillBarcode = '') {
    setSelectedRowId(null)
    setEditingId(null)
    setDeletePassword('')
    setIsDeleteModalOpen(false)
    setForm({
      ...initialForm,
      product_barcode: prefillBarcode,
    })
    setBarcodeCheckState('idle')
    setSuccess('')
    setError('')
    setIsFormOpen(true)
  }

  function handleEdit(row: ProductRow) {
    setSelectedRowId(row.product_id)
    setEditingId(row.product_id)
    setDeletePassword('')
    setIsDeleteModalOpen(false)
    setForm(mapRowToForm(row))
    setBarcodeCheckState('available')
    setSuccess('')
    setError('')
    setIsFormOpen(true)
  }

  function handleCancelForm() {
    setEditingId(null)
    setDeletePassword('')
    setIsDeleteModalOpen(false)
    setForm(initialForm)
    setBarcodeCheckState('idle')
    setIsFormOpen(false)
  }

  async function validateBarcode(barcode: string) {
    const trimmedBarcode = barcode.trim()

    if (editingId) {
      setBarcodeCheckState('available')
      return true
    }

    if (!trimmedBarcode) {
      setBarcodeCheckState('idle')
      setError('Product barcode is required.')
      return false
    }

    try {
      setBarcodeCheckState('checking')
      const response = await apiFetch<BarcodeExistsResponse>(
        `/api/products/barcode-exists?barcode=${encodeURIComponent(trimmedBarcode)}`,
      )

      if (response.exists) {
        setBarcodeCheckState('duplicate')
        setError('Product barcode already exists. Enter a unique barcode to continue.')
        return false
      }

      setBarcodeCheckState('available')
      setError('')
      return true
    } catch (checkError) {
      setBarcodeCheckState('error')
      setError(checkError instanceof Error ? checkError.message : 'Unable to validate product barcode.')
      return false
    }
  }

  function handleOpenDeleteModal() {
    if (!editingId) {
      return
    }

    setDeletePassword('')
    setError('')
    setIsDeleteModalOpen(true)
  }

  function handleCloseDeleteModal() {
    setDeletePassword('')
    setIsDeleteModalOpen(false)
  }

  async function handleDeleteFromModal() {
    if (!editingId) {
      return
    }

    if (!deletePassword) {
      setError('Password is required to delete this product.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsDeleting(true)
      await apiFetch<{ message: string }>(`/api/products/${editingId}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
        audit: {
          page: AUDIT_PAGES.INVENTORY_PRODUCTS,
          action: 'DELETE',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_PRODUCTS,
            `Deleted product "${form.product_name || 'Unknown'}" (barcode ${form.product_barcode || 'N/A'}).`,
          ),
          tableName: 'products',
          productBarcode: form.product_barcode || null,
        },
      })

      setSuccess('Product deleted successfully.')
      setSelectedRowId(null)
      setEditingId(null)
      setDeletePassword('')
      setIsDeleteModalOpen(false)
      setForm(initialForm)
      setIsFormOpen(false)
      await loadRows()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete product record.')
    } finally {
      setIsDeleting(false)
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target

    if (name === 'product_barcode' && !editingId) {
      setBarcodeCheckState('idle')
      setError('')
    }

    setForm((current) => ({ ...current, [name]: value }))
  }

  function setProductImageFile(file: File | null) {
    if (!file) {
      setForm((current) => ({ ...current, product_image_file: null }))
      return
    }

    if (!allowedImageMimeTypes.has(file.type)) {
      setError('Only png, jpg, jpeg, and webp files are allowed.')
      return
    }

    if (file.size > maxProductImageBytes) {
      setError('Product image file must be 4 MB or less.')
      return
    }

    setError('')
    setForm((current) => ({ ...current, product_image_file: file }))
  }

  function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setProductImageFile(file)
  }

  function handleImageDrop(event: DragEvent<HTMLDivElement>, disabled = false) {
    event.preventDefault()
    setIsImageDragOver(false)

    if (disabled) {
      return
    }

    const file = event.dataTransfer.files?.[0] || null
    setProductImageFile(file)
  }

  function handleImageDragOver(event: DragEvent<HTMLDivElement>, disabled = false) {
    event.preventDefault()

    if (disabled) {
      return
    }

    setIsImageDragOver(true)
  }

  function handleImageDragLeave() {
    setIsImageDragOver(false)
  }

  function handleImageDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>, disabled = false) {
    if (disabled) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      imageInputRef.current?.click()
    }
  }

  function handleOpenImagePreview(src: string, altText: string) {
    setPreviewImageSrc(src)
    setPreviewImageAlt(altText || 'Product image preview')
  }

  function handleCloseImagePreview() {
    setPreviewImageSrc('')
    setPreviewImageAlt('Product image preview')
  }

  async function handleBarcodeBlur() {
    await validateBarcode(form.product_barcode)
  }

  async function handleOpenSyncHistory(row: ProductRow) {
    const barcode = String(row.product_barcode || '').trim()

    if (!barcode) {
      setError('Selected product has no barcode.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setSyncHistoryProduct(row)
      setSyncHistoryRows([])
      setIsSyncHistoryModalOpen(true)
      setIsLoadingSyncHistory(true)

      const response = await apiFetch<ProductSyncHistoryResponse>(
        `/api/stock-batch/sync-history?product_barcode=${encodeURIComponent(barcode)}&limit=500`,
      )

      const matchedRows = (response.data || []).filter(
        (item) => String(item.product_barcode || '').trim() === barcode,
      )

      setSyncHistoryRows(matchedRows)
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Unable to load product sync history.')
    } finally {
      setIsLoadingSyncHistory(false)
    }
  }

  function handleCloseSyncHistoryModal() {
    if (isExportingSyncHistory) {
      return
    }

    setIsSyncHistoryModalOpen(false)
    setSyncHistoryProduct(null)
    setSyncHistoryRows([])
  }

  async function handleExportProductSyncHistoryPdf() {
    if (!syncHistoryProduct?.product_barcode) {
      setError('No product was selected for PDF export.')
      return
    }

    if (syncHistoryRows.length === 0) {
      setError('No sync history rows are available to export.')
      return
    }

    try {
      setError('')
      setIsExportingSyncHistory(true)

      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      })

      const barcode = String(syncHistoryProduct.product_barcode || '').trim()
      const productName = String(syncHistoryProduct.product_name || '').trim()
      const generatedAt = new Date().toLocaleString()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text('Product Sync History', 36, 36)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Barcode: ${barcode}`, 36, 56)
      doc.text(`Product: ${productName || '-'}`, 36, 72)
      doc.text(`Generated: ${generatedAt}`, 36, 88)

      autoTable(doc, {
        startY: 104,
        head: [[
          'Sync Code',
          'Date/Time',
          'User',
          'Batch ID',
          'Before',
          'Added',
          'After',
          'Cost',
          'Selling',
        ]],
        body: syncHistoryRows.map((item) => [
          String(item.sync_code || ''),
          toInputDateTime(item.sync_timestamp),
          `${item.username || ''}${item.user_id ? ` (${item.user_id})` : ''}`.trim(),
          String(item.batch_id || ''),
          String(Number(item.qty_before || 0)),
          String(Number(item.qty_added || 0)),
          String(Number(item.qty_after || 0)),
          toMoney(item.cost_price),
          toMoney(item.selling_price),
        ]),
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
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

      const safeBarcode = barcode.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown'
      const fileDate = new Date().toISOString().slice(0, 10)
      doc.save(`product-sync-history-${safeBarcode}-${fileDate}.pdf`)

      await recordAuditEvent({
        page: AUDIT_PAGES.INVENTORY_PRODUCTS,
        action: 'EXPORT',
        description: buildAuditDescription(
          AUDIT_PAGES.INVENTORY_PRODUCTS,
          `Exported product sync history PDF for "${syncHistoryProduct.product_name || 'Unknown'}" (barcode ${barcode}).`,
        ),
        tableName: 'product_batches_sync_history',
        productBarcode: barcode,
      })
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export product sync history PDF.')
    } finally {
      setIsExportingSyncHistory(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const barcodeIsValid = await validateBarcode(form.product_barcode)
    if (!barcodeIsValid) {
      return
    }

    if (!form.product_name.trim()) {
      setError('Product name is required.')
      return
    }

    try {
      setIsSaving(true)

      const payload = new FormData()
      payload.set('product_barcode', form.product_barcode)
      payload.set('product_name', form.product_name)
      payload.set('category', form.category)
      payload.set('brand', form.brand)
      payload.set('unit', form.unit)
      payload.set('rop', form.rop.trim())

      if (form.product_image_file) {
        payload.set('product_image', form.product_image_file)
      }

      const endpoint = editingId ? `/api/products/${editingId}` : '/api/products'
      const method = editingId ? 'PUT' : 'POST'

      const response = await apiFetch<{ data: ProductRow; message: string }>(endpoint, {
        method,
        body: payload,
        audit: {
          page: AUDIT_PAGES.INVENTORY_PRODUCTS,
          action: editingId ? 'UPDATE' : 'INSERT',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_PRODUCTS,
            editingId
              ? `Updated product "${form.product_name.trim()}" (barcode ${form.product_barcode.trim()}).`
              : `Added product "${form.product_name.trim()}" (barcode ${form.product_barcode.trim()}).`,
          ),
          tableName: 'products',
          productBarcode: form.product_barcode.trim(),
        },
      })

      setSuccess(response.message || 'Product saved successfully.')
      setEditingId(null)
      setForm(initialForm)
      setIsFormOpen(false)
      await loadRows()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product record.')
    } finally {
      setIsSaving(false)
    }
  }

  const normalizedSearch = searchFilter.trim().toLowerCase()
  const filteredRows = rows.filter((row) => {
    const categoryMatches = categoryFilter === 'all' || String(row.category || '').trim() === categoryFilter
    const brandMatches = brandFilter === 'all' || String(row.brand || '').trim() === brandFilter

    if (!normalizedSearch) {
      return categoryMatches && brandMatches
    }

    const searchable = [row.product_barcode, row.product_name, row.category, row.brand]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')

    return categoryMatches && brandMatches && searchable.includes(normalizedSearch)
  })

  const content = (
    <>
      <section className="settings-stack">
        {error ? <div className="error-state">{error}</div> : null}
        {success ? <div className="success-state">{success}</div> : null}

        <article className="surface-card surface-card--wide">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Products</p>
              <h1 className="audit-card-title">Products</h1>
              <p className="audit-card-description">Manage product master records stored in the products table.</p>
            </div>

            <div className="audit-card-actions">
              <button className="topbar-button topbar-button--ghost" type="button" onClick={() => void loadRows()}>
                <ButtonLabel icon="reload">Reload</ButtonLabel>
              </button>
              <button className="topbar-button" type="button" onClick={() => handleAddNew()}>
                <ButtonLabel icon="plus">Add Product</ButtonLabel>
              </button>
            </div>
          </div>

          <div className="products-filter-bar">
            <label className="field" htmlFor="product-category-filter">
              <span>Category</span>
              <select
                id="product-category-filter"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="product-brand-filter">
              <span>Brand</span>
              <select id="product-brand-filter" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
                <option value="all">All</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="product-search-filter">
              <span>Search</span>
              <input
                id="product-search-filter"
                type="search"
                placeholder="Search barcode, name, category, brand"
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.target.value)}
              />
            </label>
          </div>

          {isLoading ? <div className="empty-state">Loading products...</div> : null}
          {!isLoading && rows.length === 0 ? <div className="empty-state">No product records found.</div> : null}
          {!isLoading && rows.length > 0 && filteredRows.length === 0 ? (
            <div className="empty-state">No products match the selected filters.</div>
          ) : null}

          {!isLoading && filteredRows.length > 0 ? (
            <ThemedDataGrid variant="products">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Image</th>
                    <th>Barcode / Product Name</th>
                    <th>Brand / Category</th>
                    <th>QTY</th>
                    <th>Unit</th>
                    <th>ROP</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.product_id} className={selectedRowId === row.product_id ? 'terminal-row-selected' : ''}>
                      <td>{row.product_id}</td>
                      <td>
                        {row.product_image_path ? (
                          <button
                            type="button"
                            className="product-image-trigger"
                            onClick={() => handleOpenImagePreview(row.product_image_path || '', row.product_name || row.product_barcode || 'Product image')}
                            aria-label="Preview product image"
                          >
                            <img
                              src={row.product_image_path}
                              alt={row.product_name || row.product_barcode || 'Product image'}
                              className="product-table-image"
                              loading="lazy"
                            />
                          </button>
                        ) : (
                          <span className="product-table-image-empty">-</span>
                        )}
                      </td>
                      <td>
                        <div><strong>{row.product_barcode || ''}</strong></div>
                        <div>{row.product_name || ''}</div>
                      </td>
                      <td>
                        <div>{row.brand || ''}</div>
                        <div>{row.category || ''}</div>
                      </td>
                      <td>{toFormValue(row.qty)}</td>
                      <td>{row.unit || ''}</td>
                      <td>{toFormValue(row.rop)}</td>
                      <td>{toInputDateTime(row.created_at)}</td>
                      <td>
                        <div className="table-actions">
                          <button className="terminal-action product-history-action" type="button" onClick={() => void handleOpenSyncHistory(row)} title="View sync history" aria-label="View sync history">
                            <svg viewBox="0 0 24 24" className="product-history-icon" aria-hidden="true" focusable="false">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 7.5v6" />
                              <circle cx="12" cy="16.5" r="1" />
                            </svg>
                          </button>
                          <button className="terminal-action" type="button" onClick={() => handleEdit(row)}>
                            <ButtonLabel icon="edit">Edit</ButtonLabel>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ThemedDataGrid>
          ) : null}
        </article>
      </section>

      {isFormOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>{editingId ? 'Edit Product' : 'Add Product'}</h2>
                  <p>Use this form to save product master records.</p>
                </div>

                {editingId ? (
                  <button type="button" className="product-delete-trigger" onClick={handleOpenDeleteModal} disabled={isDeleting || isSaving}>
                    <ButtonLabel icon="delete">Delete</ButtonLabel>
                  </button>
                ) : null}
              </div>

              <form
                className={`settings-form-grid product-form-grid${editingId ? ' product-form-grid--edit' : ' product-form-grid--add'}`}
                onSubmit={handleSubmit}
              >
                {editingId ? (
                  <>
                    <div className="field product-form-image-column">
                      <label htmlFor="product_image">Product image</label>
                      <input
                        ref={imageInputRef}
                        className="product-image-file-input"
                        id="product_image"
                        name="product_image"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleImageFileChange}
                      />
                      <div
                        className={`product-image-dropzone${isImageDragOver ? ' is-drag-over' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-label="Drag and drop product image or press Enter to browse"
                        onClick={() => imageInputRef.current?.click()}
                        onKeyDown={handleImageDropzoneKeyDown}
                        onDrop={handleImageDrop}
                        onDragOver={handleImageDragOver}
                        onDragLeave={handleImageDragLeave}
                      >
                        <strong>Drag and drop image here</strong>
                        <span>or click to browse files</span>
                        <small>{form.product_image_file ? form.product_image_file.name : 'No new file selected'}</small>
                      </div>
                      <p className="field-hint">Upload one image. The server converts it to WebP automatically.</p>

                      {newImagePreviewUrl ? (
                        <div className="product-image-preview-wrap">
                          <img src={newImagePreviewUrl} alt="Selected product preview" className="product-image-preview" />
                          <span className="product-image-preview-label">New image preview</span>
                        </div>
                      ) : null}

                      {!newImagePreviewUrl && form.product_image_path ? (
                        <div className="product-image-preview-wrap product-image-preview-wrap--current">
                          <img src={form.product_image_path} alt="Current product" className="product-image-preview product-image-preview--current" />
                          <span className="product-image-preview-label">Current image</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="product-form-fields-column">
                      <div className="field">
                        <label htmlFor="product_barcode">Barcode</label>
                        <div className="barcode-input-wrap">
                          <input
                            id="product_barcode"
                            name="product_barcode"
                            value={form.product_barcode}
                            onChange={handleChange}
                            onBlur={handleBarcodeBlur}
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="product_name">Product name</label>
                        <input
                          id="product_name"
                          name="product_name"
                          value={form.product_name}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="category">Category</label>
                        <input
                          id="category"
                          name="category"
                          list="product-category-options"
                          value={form.category}
                          onChange={handleChange}
                        />
                        <datalist id="product-category-options">
                          {categories.map((category) => (
                            <option key={category} value={category} />
                          ))}
                        </datalist>
                      </div>
                      <div className="field">
                        <label htmlFor="brand">Brand</label>
                        <input
                          id="brand"
                          name="brand"
                          list="product-brand-options"
                          value={form.brand}
                          onChange={handleChange}
                        />
                        <datalist id="product-brand-options">
                          {brands.map((brand) => (
                            <option key={brand} value={brand} />
                          ))}
                        </datalist>
                      </div>
                      <div className="field">
                        <label htmlFor="unit">Unit</label>
                        <input
                          id="unit"
                          name="unit"
                          list="product-unit-options"
                          value={form.unit}
                          onChange={handleChange}
                        />
                        <datalist id="product-unit-options">
                          {units.map((unit) => (
                            <option key={unit} value={unit} />
                          ))}
                        </datalist>
                      </div>
                      <div className="field">
                        <label htmlFor="rop">Re-Order Point</label>
                        <input
                          id="rop"
                          name="rop"
                          type="number"
                          step="1"
                          value={form.rop}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {(() => {
                      const isAddImageInputDisabled = barcodeCheckState !== 'available'

                      return (
                        <>
                          <div className="field product-form-image-column">
                            <label htmlFor="product_image">Product image</label>
                            <input
                              ref={imageInputRef}
                              className="product-image-file-input"
                              id="product_image"
                              name="product_image"
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              onChange={handleImageFileChange}
                              disabled={isAddImageInputDisabled}
                            />
                            <div
                              className={`product-image-dropzone${isImageDragOver ? ' is-drag-over' : ''}${isAddImageInputDisabled ? ' is-disabled' : ''}`}
                              role="button"
                              tabIndex={isAddImageInputDisabled ? -1 : 0}
                              aria-disabled={isAddImageInputDisabled}
                              aria-label="Drag and drop product image or press Enter to browse"
                              onClick={() => {
                                if (!isAddImageInputDisabled) {
                                  imageInputRef.current?.click()
                                }
                              }}
                              onKeyDown={(event) => handleImageDropzoneKeyDown(event, isAddImageInputDisabled)}
                              onDrop={(event) => handleImageDrop(event, isAddImageInputDisabled)}
                              onDragOver={(event) => handleImageDragOver(event, isAddImageInputDisabled)}
                              onDragLeave={handleImageDragLeave}
                            >
                              <strong>Drag and drop image here</strong>
                              <span>or click to browse files</span>
                              <small>{form.product_image_file ? form.product_image_file.name : 'No new file selected'}</small>
                            </div>
                            <p className="field-hint">Upload one image. The server converts it to WebP automatically.</p>

                            {newImagePreviewUrl ? (
                              <div className="product-image-preview-wrap">
                                <img src={newImagePreviewUrl} alt="Selected product preview" className="product-image-preview" />
                                <span className="product-image-preview-label">New image preview</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="product-form-fields-column">
                            <div className="field">
                              <label htmlFor="product_barcode">Barcode</label>
                              <div className="barcode-input-wrap">
                                <input
                                  id="product_barcode"
                                  name="product_barcode"
                                  value={form.product_barcode}
                                  onChange={handleChange}
                                  onBlur={handleBarcodeBlur}
                                  autoFocus
                                />
                                {barcodeCheckState === 'available' ? (
                                  <span className="barcode-status-icon barcode-status-icon--ok" aria-label="Barcode available" title="Barcode available">
                                    ✓
                                  </span>
                                ) : null}
                                {barcodeCheckState === 'duplicate' ? (
                                  <span className="barcode-status-icon barcode-status-icon--bad" aria-label="Barcode already exists" title="Barcode already exists">
                                    ✕
                                  </span>
                                ) : null}
                              </div>
                              <p className="field-hint">
                                {barcodeCheckState === 'checking'
                                  ? 'Checking barcode...'
                                  : barcodeCheckState === 'duplicate'
                                    ? 'This barcode already exists.'
                                    : 'Enter a unique barcode to continue.'}
                              </p>
                            </div>
                            <div className="field">
                              <label htmlFor="product_name">Product name</label>
                              <input
                                id="product_name"
                                name="product_name"
                                value={form.product_name}
                                onChange={handleChange}
                                disabled={barcodeCheckState !== 'available'}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor="category">Category</label>
                              <input
                                id="category"
                                name="category"
                                list="product-category-options"
                                value={form.category}
                                onChange={handleChange}
                                disabled={barcodeCheckState !== 'available'}
                              />
                              <datalist id="product-category-options">
                                {categories.map((category) => (
                                  <option key={category} value={category} />
                                ))}
                              </datalist>
                            </div>
                            <div className="field">
                              <label htmlFor="brand">Brand</label>
                              <input
                                id="brand"
                                name="brand"
                                list="product-brand-options"
                                value={form.brand}
                                onChange={handleChange}
                                disabled={barcodeCheckState !== 'available'}
                              />
                              <datalist id="product-brand-options">
                                {brands.map((brand) => (
                                  <option key={brand} value={brand} />
                                ))}
                              </datalist>
                            </div>
                            <div className="field">
                              <label htmlFor="unit">Unit</label>
                              <input
                                id="unit"
                                name="unit"
                                list="product-unit-options"
                                value={form.unit}
                                onChange={handleChange}
                                disabled={barcodeCheckState !== 'available'}
                              />
                              <datalist id="product-unit-options">
                                {units.map((unit) => (
                                  <option key={unit} value={unit} />
                                ))}
                              </datalist>
                            </div>
                            <div className="field">
                              <label htmlFor="rop">Re-Order Point</label>
                              <input
                                id="rop"
                                name="rop"
                                type="number"
                                step="1"
                                value={form.rop}
                                onChange={handleChange}
                                disabled={barcodeCheckState !== 'available'}
                              />
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </>
                )}

                <div className="settings-actions field--full">
                  <ThemedButton type="button" variant="secondary" onClick={handleCancelForm} disabled={isSaving}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isSaving || isDeleting}>
                    <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Save Product'}</ButtonLabel>
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : null}

      {isDeleteModalOpen && editingId ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card terminal-delete-modal">
              <div className="panel-header">
                <div>
                  <h2>Delete Product</h2>
                  <p>Enter your password to permanently delete this product record.</p>
                </div>
              </div>

              <form
                className="settings-stack"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleDeleteFromModal()
                }}
              >
                <div className="field">
                  <label htmlFor="delete_password">Password validation</label>
                  <input
                    id="delete_password"
                    name="delete_password"
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <div className="settings-actions">
                  <ThemedButton type="button" variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isDeleting}>
                    <ButtonLabel icon="delete">{isDeleting ? 'Verifying...' : 'Confirm delete'}</ButtonLabel>
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : null}

      {isSyncHistoryModalOpen && syncHistoryProduct ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal product-sync-history-shell" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card product-sync-history-modal">
              <div className="panel-header">
                <div>
                  <h2>Product Sync History</h2>
                  <p>
                    Barcode {syncHistoryProduct.product_barcode || ''} - {syncHistoryProduct.product_name || ''}
                  </p>
                </div>
              </div>

              {isLoadingSyncHistory ? <div className="empty-state">Loading sync history...</div> : null}
              {!isLoadingSyncHistory && syncHistoryRows.length === 0 ? (
                <div className="empty-state">No sync history found for this product.</div>
              ) : null}

              {!isLoadingSyncHistory && syncHistoryRows.length > 0 ? (
                <div className="product-sync-history-table-wrap">
                  <table className="data-table data-table--product-sync-history">
                    <thead>
                      <tr>
                        <th>Sync Code</th>
                        <th>Date/Time</th>
                        <th>Batch ID</th>
                        <th>Current Qty</th>
                        <th>Sync Qty</th>
                        <th>After Qty</th>
                        <th>Cost</th>
                        <th>Selling</th>
                        <th>Responsible User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHistoryRows.map((item) => (
                        <tr key={item.id}>
                          <td>{item.sync_code || ''}</td>
                          <td>{toInputDateTime(item.sync_timestamp)}</td>
                          <td>{item.batch_id || ''}</td>
                          <td><span className="stock-batch-sync-qty stock-batch-sync-qty--before">{Number(item.qty_before || 0)}</span></td>
                          <td><span className="stock-batch-sync-qty stock-batch-sync-qty--add">{Number(item.qty_added || 0)}</span></td>
                          <td><span className="stock-batch-sync-qty stock-batch-sync-qty--after">{Number(item.qty_after || 0)}</span></td>
                          <td>{toMoney(item.cost_price)}</td>
                          <td>{toMoney(item.selling_price)}</td>
                          <td>
                            <div>{item.username || item.user_id || '-'}</div>
                            <div>{item.username && item.user_id ? item.user_id : ''}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="settings-actions">
                <ThemedButton type="button" variant="secondary" onClick={handleCloseSyncHistoryModal} disabled={isExportingSyncHistory}>
                  <ButtonLabel icon="close">Close</ButtonLabel>
                </ThemedButton>
                <ThemedButton
                  type="button"
                  variant="primary"
                  onClick={() => void handleExportProductSyncHistoryPdf()}
                  disabled={isLoadingSyncHistory || isExportingSyncHistory || syncHistoryRows.length === 0}
                >
                  <ButtonLabel icon="export">{isExportingSyncHistory ? 'Exporting PDF...' : 'Export to PDF'}</ButtonLabel>
                </ThemedButton>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {previewImageSrc ? (
        <div className="terminal-modal-backdrop" role="presentation" onClick={handleCloseImagePreview}>
          <div className="terminal-modal image-preview-shell" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card image-preview-modal">
              <img src={previewImageSrc} alt={previewImageAlt} className="image-preview-modal__image" />
              <div className="settings-actions">
                <ThemedButton type="button" variant="primary" onClick={handleCloseImagePreview}>
                  <ButtonLabel icon="close">Close</ButtonLabel>
                </ThemedButton>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <AdminShell
      title="Products"
      description="Manage product master records stored in the products table."
      hideTopbar
    >
      {content}
    </AdminShell>
  )
}

export default ProductsPage