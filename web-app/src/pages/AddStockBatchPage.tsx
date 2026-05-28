import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'

type BatchTemplateRow = {
  ID: number
  BatchID: string | null
  CATEGORY: string | null
  BARCODE: string | null
  DESCRIPTION: string | null
  BRAND: string | null
  PRODUCT_IMAGE_PATH: string | null
  UNIT: string | null
  QTY: number | null
  COSTPRICE: number | null
  SELLINGPRICE: number | null
  EXPIRATION: string | null
  USERID: string | null
}

type BatchTemplateListResponse = {
  data: BatchTemplateRow[]
}

type StockBatchProductRow = {
  product_id: number
  product_barcode: string | null
  product_name: string | null
  category: string | null
  brand: string | null
  product_image_path: string | null
  unit: string | null
}

type StockBatchProductsResponse = {
  data: StockBatchProductRow[]
}

type StockBatchSyncPreviewRow = {
  barcode: string | null
  description: string | null
  beforeQty: number
  addQty: number
  afterQty: number
}

type StockBatchSyncPreviewResponse = {
  data: StockBatchSyncPreviewRow[]
}

type StockBatchSyncResponse = {
  data: {
    syncedRows: number
    syncedProducts: number
  }
  message: string
}

type ProductsResponse = {
  categories: string[]
  brands: string[]
  units: string[]
}

type ProductCreateResponse = {
  message: string
}

type DeleteBatchTemplateResponse = {
  message: string
}

type UpdateBatchTemplateResponse = {
  data: BatchTemplateRow
  message: string
}

type BarcodeExistsResponse = {
  exists: boolean
}

type BarcodeSubmitResponse = {
  data: BatchTemplateRow
  message: string
}

type BarcodeDetailsContext = {
  barcode: string
  description: string | null
  category: string | null
  brand: string | null
  unit: string | null
}

type NewEntryDetailsForm = {
  qty: string
  costPrice: string
  sellingPrice: string
  expiration: string
}

type AddProductForm = {
  product_barcode: string
  product_name: string
  category: string
  brand: string
  unit: string
  rop: string
}

type ModifyBatchForm = {
  qty: string
  costPrice: string
  sellingPrice: string
  expiration: string
}

type BarcodeCheckState = 'idle' | 'checking' | 'available' | 'duplicate' | 'error'

const initialDetailsForm: NewEntryDetailsForm = {
  qty: '1',
  costPrice: '',
  sellingPrice: '',
  expiration: '',
}

const initialAddProductForm: AddProductForm = {
  product_barcode: '',
  product_name: '',
  category: '',
  brand: '',
  unit: '',
  rop: '20',
}

const initialModifyBatchForm: ModifyBatchForm = {
  qty: '',
  costPrice: '',
  sellingPrice: '',
  expiration: '',
}

function formatDate(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString()
}

function formatNumber(value: number | null) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function toInputDate(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type AddStockBatchPageProps = {
  embedded?: boolean
}

function AddStockBatchPage({ embedded = false }: AddStockBatchPageProps) {
  usePageVisitAudit(AUDIT_PAGES.INVENTORY_STOCK_BATCH)
  const detailsQtyRef = useRef<HTMLInputElement | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement | null>(null)
  const addProductNameRef = useRef<HTMLInputElement | null>(null)
  const [barcode, setBarcode] = useState('')
  const [rows, setRows] = useState<BatchTemplateRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [isLoadingRows, setIsLoadingRows] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [isDeletingRow, setIsDeletingRow] = useState(false)
  const [isModifyingRow, setIsModifyingRow] = useState(false)
  const [isSyncPreviewLoading, setIsSyncPreviewLoading] = useState(false)
  const [isSyncingInventory, setIsSyncingInventory] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [isLoadingSearchProducts, setIsLoadingSearchProducts] = useState(false)
  const [rowToDelete, setRowToDelete] = useState<BatchTemplateRow | null>(null)
  const [rowToModify, setRowToModify] = useState<BatchTemplateRow | null>(null)
  const [searchProducts, setSearchProducts] = useState<StockBatchProductRow[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchCategoryFilter, setSearchCategoryFilter] = useState('all')
  const [searchBrandFilter, setSearchBrandFilter] = useState('all')
  const [syncPassword, setSyncPassword] = useState('')
  const [isSyncCompletedModalOpen, setIsSyncCompletedModalOpen] = useState(false)
  const [syncCompletedMessage, setSyncCompletedMessage] = useState('')
  const [syncPreviewRows, setSyncPreviewRows] = useState<StockBatchSyncPreviewRow[]>([])
  const [detailsContext, setDetailsContext] = useState<BarcodeDetailsContext | null>(null)
  const [detailsForm, setDetailsForm] = useState<NewEntryDetailsForm>(initialDetailsForm)
  const [addProductForm, setAddProductForm] = useState<AddProductForm>(initialAddProductForm)
  const [modifyForm, setModifyForm] = useState<ModifyBatchForm>(initialModifyBatchForm)
  const [addProductBarcodeCheckState, setAddProductBarcodeCheckState] = useState<BarcodeCheckState>('idle')
  const [previewImageSrc, setPreviewImageSrc] = useState('')
  const [previewImageAlt, setPreviewImageAlt] = useState('Product image preview')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void loadRows()
  }, [])

  useEffect(() => {
    if (!isDetailsModalOpen) {
      return
    }

    const timer = window.setTimeout(() => {
      detailsQtyRef.current?.focus()
      detailsQtyRef.current?.select()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isDetailsModalOpen])

  useEffect(() => {
    if (!isAddProductModalOpen || addProductBarcodeCheckState !== 'available') {
      return
    }

    const timer = window.setTimeout(() => {
      addProductNameRef.current?.focus()
      addProductNameRef.current?.select()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isAddProductModalOpen, addProductBarcodeCheckState])

  useEffect(() => {
    return focusAndSelectBarcodeInput()
  }, [])

  async function loadRows() {
    try {
      setIsLoadingRows(true)
      const response = await apiFetch<BatchTemplateListResponse>('/api/stock-batch/templates?limit=200')
      setRows(response.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load stock batch template rows.')
    } finally {
      setIsLoadingRows(false)
    }
  }

  async function loadSearchProducts() {
    try {
      setIsLoadingSearchProducts(true)
      const response = await apiFetch<StockBatchProductsResponse>('/api/stock-batch/products')
      setSearchProducts(response.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load products for search.')
    } finally {
      setIsLoadingSearchProducts(false)
    }
  }

  async function handleOpenSearchModal() {
    setError('')
    setSearchKeyword('')
    setSearchCategoryFilter('all')
    setSearchBrandFilter('all')
    setIsSearchModalOpen(true)

    if (searchProducts.length === 0) {
      await loadSearchProducts()
    }
  }

  function focusAndSelectBarcodeInput() {
    const timer = window.setTimeout(() => {
      barcodeInputRef.current?.focus()
      barcodeInputRef.current?.select()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }

  function clearAndRefocusBarcodeInput() {
    setBarcode('')
    focusAndSelectBarcodeInput()
  }

  function handleCloseSyncCompletedModal() {
    setIsSyncCompletedModalOpen(false)
    setSyncCompletedMessage('')
    focusAndSelectBarcodeInput()
  }

  function handleCloseSearchModal() {
    setIsSearchModalOpen(false)
    clearAndRefocusBarcodeInput()
  }

  function handleOpenImagePreview(src: string, altText: string) {
    setPreviewImageSrc(src)
    setPreviewImageAlt(altText || 'Product image preview')
  }

  function handleCloseImagePreview() {
    setPreviewImageSrc('')
    setPreviewImageAlt('Product image preview')
  }

  async function handleOpenSyncModal() {
    if (!hasAtLeastOneQtyRow) {
      return
    }

    setError('')
    setSuccess('')
    setSyncPassword('')
    setIsSyncModalOpen(true)
    setIsSyncPreviewLoading(true)

    try {
      const response = await apiFetch<StockBatchSyncPreviewResponse>('/api/stock-batch/sync-preview')
      const previewRows = response.data || []
      setSyncPreviewRows(previewRows)

      if (previewRows.length === 0) {
        setIsSyncModalOpen(false)
        setError('No eligible stock batch template rows were found for syncing.')
      }
    } catch (previewError) {
      setIsSyncModalOpen(false)
      setError(previewError instanceof Error ? previewError.message : 'Unable to load sync preview.')
    } finally {
      setIsSyncPreviewLoading(false)
    }
  }

  function handleCloseSyncModal() {
    if (isSyncingInventory) {
      return
    }

    setIsSyncModalOpen(false)
    setSyncPreviewRows([])
    setSyncPassword('')
    clearAndRefocusBarcodeInput()
  }

  async function handleConfirmSyncToInventory() {
    if (syncPreviewRows.length === 0) {
      setError('No eligible stock batch template rows were found for syncing.')
      return
    }

    if (!syncPassword.trim()) {
      setError('Password is required to confirm sync.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsSyncingInventory(true)

      const response = await apiFetch<StockBatchSyncResponse>('/api/stock-batch/sync', {
        method: 'POST',
        body: JSON.stringify({ password: syncPassword }),
        audit: {
          page: AUDIT_PAGES.INVENTORY_STOCK_BATCH,
          action: 'SYNC',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_STOCK_BATCH,
            `Synced ${syncPreviewRows.length} stock batch template row(s) to inventory.`,
          ),
          tableName: 'product_batches',
        },
      })

      setSuccess(response.message || 'Stock batches synced to inventory successfully.')
      setSyncCompletedMessage('Stock has been added to the products inventory.')
      setIsSyncCompletedModalOpen(true)
      setIsSyncModalOpen(false)
      setSyncPreviewRows([])
      setSyncPassword('')
      await loadRows()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync stock batches to inventory.')
    } finally {
      setIsSyncingInventory(false)
    }
  }

  async function handleSelectSearchProduct(product: StockBatchProductRow) {
    const selectedBarcode = String(product.product_barcode || '').trim()
    setBarcode(selectedBarcode)
    setIsSearchModalOpen(false)

    if (!selectedBarcode) {
      setError('Barcode is required.')
      return
    }

    await submitBarcode(selectedBarcode)
  }

  async function loadProductMetaOptions() {
    try {
      const response = await apiFetch<ProductsResponse>('/api/products')
      setCategories(response.categories || [])
      setBrands(response.brands || [])
      setUnits(response.units || [])
    } catch (_error) {
      setCategories([])
      setBrands([])
      setUnits([])
    }
  }

  async function openAddProductModal(prefillBarcode: string) {
    const normalizedBarcode = String(prefillBarcode || '').trim()

    if (categories.length === 0 && brands.length === 0 && units.length === 0) {
      await loadProductMetaOptions()
    }

    setAddProductForm({
      ...initialAddProductForm,
      product_barcode: normalizedBarcode,
    })
    setAddProductBarcodeCheckState('idle')
    setIsAddProductModalOpen(true)

    if (normalizedBarcode) {
      await validateAddProductBarcode(normalizedBarcode)
    }
  }

  async function validateAddProductBarcode(barcodeValue: string) {
    const trimmedBarcode = barcodeValue.trim()

    if (!trimmedBarcode) {
      setAddProductBarcodeCheckState('idle')
      setError('Product barcode is required.')
      return false
    }

    try {
      setAddProductBarcodeCheckState('checking')
      const response = await apiFetch<BarcodeExistsResponse>(
        `/api/products/barcode-exists?barcode=${encodeURIComponent(trimmedBarcode)}`,
      )

      if (response.exists) {
        setAddProductBarcodeCheckState('duplicate')
        setError('Product barcode already exists. Enter a unique barcode to continue.')
        return false
      }

      setAddProductBarcodeCheckState('available')
      setError('')
      return true
    } catch (checkError) {
      setAddProductBarcodeCheckState('error')
      setError(checkError instanceof Error ? checkError.message : 'Unable to validate product barcode.')
      return false
    }
  }

  async function handleAddProductBarcodeBlur() {
    await validateAddProductBarcode(addProductForm.product_barcode)
  }

  async function submitBarcode(normalizedBarcode: string) {
    setError('')
    setSuccess('')

    try {
      setIsSubmitting(true)
      const response = await apiFetch<BarcodeSubmitResponse>('/api/stock-batch/templates/by-barcode', {
        method: 'POST',
        body: JSON.stringify({ barcode: normalizedBarcode }),
        audit: {
          page: AUDIT_PAGES.INVENTORY_STOCK_BATCH,
          action: 'INSERT',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_STOCK_BATCH,
            `Added stock batch template row for barcode ${normalizedBarcode}.`,
          ),
          tableName: 'stock_batch_templates',
          productBarcode: normalizedBarcode,
        },
      })

      const batchId = response.data?.BatchID || ''
      const successMessage = response.message || 'Stock batch template row created successfully.'
      setSuccess(batchId ? `${successMessage} Batch ID: ${batchId}` : successMessage)
      setBarcode('')
      await loadRows()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save stock batch template row.'
      const detailsCode = String((saveError as { code?: string })?.code || '')
      const detailsData = (saveError as { data?: BarcodeDetailsContext })?.data

      if (detailsCode === 'DETAILS_REQUIRED' && detailsData?.barcode) {
        setDetailsContext(detailsData)
        setDetailsForm(initialDetailsForm)
        setIsDetailsModalOpen(true)
        return
      }

      if (message.toLowerCase().includes('no matching product found')) {
        await openAddProductModal(normalizedBarcode)
        return
      }

      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedBarcode = barcode.trim()

    if (!normalizedBarcode) {
      setError('Barcode is required.')
      return
    }

    await submitBarcode(normalizedBarcode)
  }

  const normalizedSearchKeyword = searchKeyword.trim().toLowerCase()
  const searchCategories = Array.from(
    new Set(searchProducts.map((product) => String(product.category || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))
  const searchBrands = Array.from(
    new Set(searchProducts.map((product) => String(product.brand || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))

  const filteredSearchProducts = searchProducts.filter((product) => {
    const categoryMatches = searchCategoryFilter === 'all' || String(product.category || '').trim() === searchCategoryFilter
    const brandMatches = searchBrandFilter === 'all' || String(product.brand || '').trim() === searchBrandFilter

    if (!categoryMatches || !brandMatches) {
      return false
    }

    if (!normalizedSearchKeyword) {
      return true
    }

    const searchableText = [
      product.product_barcode,
      product.product_name,
      product.category,
      product.brand,
      product.unit,
    ]
      .map((value) => String(value || '').toLowerCase())
      .join(' ')

    return searchableText.includes(normalizedSearchKeyword)
  })
  const visibleSearchProducts = filteredSearchProducts.slice(0, 13)

  const hasAtLeastOneQtyRow = rows.some((row) => Number(row.QTY ?? 0) >= 1)

  async function handleSubmitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!detailsContext?.barcode) {
      setError('No pending barcode entry was found.')
      return
    }

    if (!detailsForm.qty.trim() || !detailsForm.costPrice.trim() || !detailsForm.sellingPrice.trim()) {
      setError('Qty, Cost, and Selling Price are required.')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await apiFetch<BarcodeSubmitResponse>('/api/stock-batch/templates/by-barcode', {
        method: 'POST',
        body: JSON.stringify({
          barcode: detailsContext.barcode,
          qty: Number(detailsForm.qty),
          costPrice: Number(detailsForm.costPrice),
          sellingPrice: Number(detailsForm.sellingPrice),
          expiration: detailsForm.expiration,
        }),
        audit: {
          page: AUDIT_PAGES.INVENTORY_STOCK_BATCH,
          action: 'INSERT',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_STOCK_BATCH,
            `Added stock batch template row for barcode ${detailsContext.barcode} with qty ${detailsForm.qty}.`,
          ),
          tableName: 'stock_batch_templates',
          productBarcode: detailsContext.barcode,
        },
      })

      const batchId = response.data?.BatchID || ''
      const successMessage = response.message || 'Stock batch template row created successfully.'
      setSuccess(batchId ? `${successMessage} Batch ID: ${batchId}` : successMessage)
      setBarcode('')
      setIsDetailsModalOpen(false)
      setDetailsContext(null)
      setDetailsForm(initialDetailsForm)
      await loadRows()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save stock batch template row details.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCloseDetailsModal() {
    setIsDetailsModalOpen(false)
    setDetailsContext(null)
    setDetailsForm(initialDetailsForm)
    clearAndRefocusBarcodeInput()
  }

  function handleCloseAddProductModal() {
    setIsAddProductModalOpen(false)
    setAddProductForm(initialAddProductForm)
    setAddProductBarcodeCheckState('idle')
    clearAndRefocusBarcodeInput()
  }

  function handleOpenDeleteConfirm(row: BatchTemplateRow) {
    setRowToDelete(row)
    setIsDeleteConfirmOpen(true)
  }

  function handleOpenModifyModal(row: BatchTemplateRow) {
    setRowToModify(row)
    setModifyForm({
      qty: formatNumber(row.QTY),
      costPrice: formatNumber(row.COSTPRICE),
      sellingPrice: formatNumber(row.SELLINGPRICE),
      expiration: toInputDate(row.EXPIRATION),
    })
    setIsModifyModalOpen(true)
  }

  function handleCloseDeleteConfirm() {
    setRowToDelete(null)
    setIsDeleteConfirmOpen(false)
    clearAndRefocusBarcodeInput()
  }

  function handleCloseModifyModal() {
    setRowToModify(null)
    setModifyForm(initialModifyBatchForm)
    setIsModifyModalOpen(false)
    clearAndRefocusBarcodeInput()
  }

  async function handleConfirmDelete() {
    if (!rowToDelete) {
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsDeletingRow(true)

      const response = await apiFetch<DeleteBatchTemplateResponse>(`/api/stock-batch/templates/${rowToDelete.ID}`, {
        method: 'DELETE',
        audit: {
          page: AUDIT_PAGES.INVENTORY_STOCK_BATCH,
          action: 'DELETE',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_STOCK_BATCH,
            `Deleted stock batch template row for "${rowToDelete.DESCRIPTION || 'Unknown'}" (barcode ${rowToDelete.BARCODE || 'N/A'}).`,
          ),
          tableName: 'stock_batch_templates',
          productBarcode: rowToDelete.BARCODE || null,
        },
      })

      setSuccess(response.message || 'Stock batch template row deleted successfully.')
      handleCloseDeleteConfirm()
      await loadRows()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete stock batch template row.')
    } finally {
      setIsDeletingRow(false)
    }
  }

  async function handleSubmitModify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!rowToModify) {
      return
    }

    if (!modifyForm.qty.trim() || !modifyForm.costPrice.trim() || !modifyForm.sellingPrice.trim()) {
      setError('Qty, Cost, and Selling Price are required.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsModifyingRow(true)

      const response = await apiFetch<UpdateBatchTemplateResponse>(`/api/stock-batch/templates/${rowToModify.ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          qty: Number(modifyForm.qty),
          costPrice: Number(modifyForm.costPrice),
          sellingPrice: Number(modifyForm.sellingPrice),
          expiration: modifyForm.expiration || null,
        }),
        audit: {
          page: AUDIT_PAGES.INVENTORY_STOCK_BATCH,
          action: 'UPDATE',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_STOCK_BATCH,
            `Updated stock batch template row for "${rowToModify.DESCRIPTION || 'Unknown'}" (barcode ${rowToModify.BARCODE || 'N/A'}).`,
          ),
          tableName: 'stock_batch_templates',
          productBarcode: rowToModify.BARCODE || null,
        },
      })

      setSuccess(response.message || 'Stock batch template row updated successfully.')
      handleCloseModifyModal()
      await loadRows()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update stock batch template row.')
    } finally {
      setIsModifyingRow(false)
    }
  }

  async function handleAddProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!addProductForm.product_barcode.trim()) {
      setError('Product barcode is required.')
      return
    }

    const barcodeIsValid = await validateAddProductBarcode(addProductForm.product_barcode)
    if (!barcodeIsValid) {
      return
    }

    if (!addProductForm.product_name.trim()) {
      setError('Product name is required.')
      return
    }

    try {
      setIsCreatingProduct(true)
      const response = await apiFetch<ProductCreateResponse>('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          product_barcode: addProductForm.product_barcode.trim(),
          product_name: addProductForm.product_name.trim(),
          category: addProductForm.category.trim(),
          brand: addProductForm.brand.trim(),
          unit: addProductForm.unit.trim(),
          rop: addProductForm.rop.trim() ? Number(addProductForm.rop) : null,
        }),
        audit: {
          page: AUDIT_PAGES.INVENTORY_STOCK_BATCH,
          action: 'INSERT',
          description: buildAuditDescription(
            AUDIT_PAGES.INVENTORY_STOCK_BATCH,
            `Created product "${addProductForm.product_name.trim()}" (barcode ${addProductForm.product_barcode.trim()}) from Add Stock Batch.`,
          ),
          tableName: 'products',
          productBarcode: addProductForm.product_barcode.trim(),
        },
      })

      setSuccess(response.message || 'Product created successfully. You can now submit this barcode for stock batch.')
      setBarcode(addProductForm.product_barcode.trim())
      setIsAddProductModalOpen(false)
      setAddProductForm(initialAddProductForm)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create product.')
    } finally {
      setIsCreatingProduct(false)
    }
  }

  const content = (
    <>
      <section className="settings-stack">
        {error ? <div className="error-state">{error}</div> : null}
        {success ? <div className="success-state">{success}</div> : null}

        <article className="surface-card surface-card--wide stock-batch-shell">
          <div className="audit-card-header stock-batch-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Add Stock Batch</p>
              <h1 className="audit-card-title">Add Stock Batch</h1>
              <p className="audit-card-description">
                Scan or type a product barcode to add or update a temporary stock batch row, then use Modify or Delete
                actions to maintain template data.
              </p>
            </div>
            <div className="audit-card-actions stock-batch-toolbar">
              <button
                type="button"
                className="stock-batch-search-indicator"
                aria-label="Search barcode"
                onClick={() => void handleOpenSearchModal()}
              >
                <svg viewBox="0 0 24 24" className="stock-batch-search-indicator__icon" focusable="false">
                  <circle cx="11" cy="11" r="6" />
                  <path d="M16 16l4 4" />
                </svg>
                <span className="stock-batch-search-indicator__label">Search</span>
              </button>

              <form className="stock-batch-toolbar-form" onSubmit={handleSubmit}>
                <label className="stock-batch-barcode-wrap" aria-label="Barcode input">
                  <svg className="stock-batch-barcode-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M4 4v16" />
                    <path d="M7 4v16" />
                    <path d="M10 4v16" />
                    <path d="M14 4v16" />
                    <path d="M16 4v16" />
                    <path d="M20 4v16" />
                  </svg>
                  <input
                    ref={barcodeInputRef}
                    className="stock-batch-barcode-input"
                    type="text"
                    value={barcode}
                    onChange={(event) => setBarcode(event.target.value)}
                    placeholder="BARCODE HERE"
                  />
                </label>
                <button className="stock-batch-submit" type="submit" disabled={isSubmitting}>
                  <ButtonLabel icon="submit">{isSubmitting ? 'SUBMITTING...' : 'SUBMIT'}</ButtonLabel>
                </button>
              </form>
            </div>
          </div>

          <section className="stock-batch-board" aria-live="polite">
            {isLoadingRows ? <div className="stock-batch-board-placeholder">LOADING TEMPLATE DATA...</div> : null}

            {!isLoadingRows && rows.length === 0 ? (
              <div className="stock-batch-board-placeholder" aria-label="No stock batch template rows yet">
                <svg
                  className="stock-batch-empty-icon"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect x="4" y="3" width="16" height="18" rx="2" />
                  <line x1="8" y1="8" x2="16" y2="8" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                  <line x1="8" y1="16" x2="13" y2="16" />
                </svg>
              </div>
            ) : null}

            {!isLoadingRows && rows.length > 0 ? (
              <div className="stock-batch-table-wrap">
                <table className="data-table data-table--stock-batch">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>IMAGE</th>
                      <th>BARCODE</th>
                      <th>BATCH ID</th>
                      <th>DESCRIPTION</th>
                      <th>CATEGORY</th>
                      <th>BRAND</th>
                      <th>UNIT</th>
                      <th>QTY</th>
                      <th>COST</th>
                      <th>SELLING</th>
                      <th>EXPIRATION</th>
                      <th>USER ID</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.ID}>
                        <td>{row.ID}</td>
                        <td>
                          {row.PRODUCT_IMAGE_PATH ? (
                            <button
                              type="button"
                              className="product-image-trigger"
                              onClick={() => handleOpenImagePreview(row.PRODUCT_IMAGE_PATH || '', row.DESCRIPTION || row.BARCODE || 'Product image')}
                              aria-label="Preview product image"
                            >
                              <img
                                src={row.PRODUCT_IMAGE_PATH}
                                alt={row.DESCRIPTION || row.BARCODE || 'Product image'}
                                className="product-table-image"
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <span className="product-table-image-empty">-</span>
                          )}
                        </td>
                        <td>{row.BARCODE || ''}</td>
                        <td>{row.BatchID || ''}</td>
                        <td>{row.DESCRIPTION || ''}</td>
                        <td>{row.CATEGORY || ''}</td>
                        <td>{row.BRAND || ''}</td>
                        <td>{row.UNIT || ''}</td>
                        <td>{formatNumber(row.QTY)}</td>
                        <td>{formatNumber(row.COSTPRICE)}</td>
                        <td>{formatNumber(row.SELLINGPRICE)}</td>
                        <td>{formatDate(row.EXPIRATION)}</td>
                        <td>{row.USERID || ''}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="terminal-action stock-batch-modify-button"
                              onClick={() => handleOpenModifyModal(row)}
                              aria-label="Modify row"
                              title="Modify row"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="stock-batch-edit-icon">
                                <path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5z" />
                                <path d="M13.5 7l3.5 3.5" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="terminal-action stock-batch-delete-button"
                              onClick={() => handleOpenDeleteConfirm(row)}
                              aria-label="Delete row"
                              title="Delete row"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="stock-batch-trash-icon">
                                <path d="M4 7h16" />
                                <path d="M9 7V5h6v2" />
                                <path d="M8 7l1 12h6l1-12" />
                                <path d="M10 10v6" />
                                <path d="M14 10v6" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </article>
      </section>

      {hasAtLeastOneQtyRow ? (
        <button
          type="button"
          className="stock-batch-bottom-action button-primary"
          onClick={() => void handleOpenSyncModal()}
          disabled={isSyncPreviewLoading || isSyncingInventory}
        >
          <ButtonLabel icon="sync">Sync to Inventory!</ButtonLabel>
        </button>
      ) : null}

      {isSyncModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal stock-batch-sync-shell" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card stock-batch-sync-modal">
              <div className="panel-header">
                <div>
                  <h2>Sync to Inventory</h2>
                  <p>Review product stock quantities before syncing template rows into product batches.</p>
                </div>
              </div>

              {isSyncPreviewLoading ? <div className="empty-state">Loading sync preview...</div> : null}

              {!isSyncPreviewLoading && syncPreviewRows.length > 0 ? (
                <div className="stock-batch-sync-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Barcode</th>
                        <th>Description</th>
                        <th>Current Stock Qty</th>
                        <th>Sync Qty</th>
                        <th>After Sync Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncPreviewRows.map((row) => (
                        <tr key={`${row.barcode || ''}-${row.description || ''}`}>
                          <td>{row.barcode || ''}</td>
                          <td>{row.description || ''}</td>
                          <td>
                            <span className="stock-batch-sync-qty stock-batch-sync-qty--before">{row.beforeQty}</span>
                          </td>
                          <td>
                            <span className="stock-batch-sync-qty stock-batch-sync-qty--add">{row.addQty}</span>
                          </td>
                          <td>
                            <span className="stock-batch-sync-qty stock-batch-sync-qty--after">{row.afterQty}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="sync_password">Password validation</label>
                <input
                  id="sync_password"
                  name="sync_password"
                  type="password"
                  value={syncPassword}
                  onChange={(event) => setSyncPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={isSyncPreviewLoading || isSyncingInventory}
                />
              </div>

              <div className="settings-actions">
                <ThemedButton
                  type="button"
                  variant="secondary"
                  onClick={handleCloseSyncModal}
                  disabled={isSyncPreviewLoading || isSyncingInventory}
                >
                  <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                </ThemedButton>
                <ThemedButton
                  type="button"
                  variant="primary"
                  onClick={() => void handleConfirmSyncToInventory()}
                  disabled={isSyncPreviewLoading || isSyncingInventory || syncPreviewRows.length === 0 || !syncPassword.trim()}
                >
                  <ButtonLabel icon="sync">{isSyncingInventory ? 'Syncing...' : 'Confirm Sync'}</ButtonLabel>
                </ThemedButton>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {isSyncCompletedModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal terminal-delete-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card stock-sync-complete-modal">
              <div className="stock-sync-complete-animation" aria-hidden="true">
                <svg viewBox="0 0 52 52" className="stock-sync-complete-icon" focusable="false">
                  <circle className="stock-sync-complete-circle" cx="26" cy="26" r="23" />
                  <path className="stock-sync-complete-check" d="M14 27l8 8 16-17" />
                </svg>
              </div>

              <h2>Sync Completed</h2>
              <p>{syncCompletedMessage || 'Stock has been added to the products inventory.'}</p>

              <div className="settings-actions">
                <ThemedButton type="button" variant="primary" onClick={handleCloseSyncCompletedModal}>
                  <ButtonLabel icon="close">Close</ButtonLabel>
                </ThemedButton>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {isDetailsModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card terminal-delete-modal">
              <div className="panel-header">
                <div>
                  <h2>New Product Batch Details</h2>
                  <p>
                    Barcode {detailsContext?.barcode || ''} is not yet in template table. Enter Qty, Cost, and Selling Price. Expiration is optional.
                  </p>
                </div>
              </div>

              <div className="settings-stack">
                <div className="field">
                  <label>Product Description</label>
                  <input value={detailsContext?.description || ''} readOnly />
                </div>

                <div className="field">
                  <label>Category</label>
                  <input value={detailsContext?.category || ''} readOnly />
                </div>

                <div className="field">
                  <label>Brand</label>
                  <input value={detailsContext?.brand || ''} readOnly />
                </div>

                <div className="field">
                  <label>Unit</label>
                  <input value={detailsContext?.unit || ''} readOnly />
                </div>
              </div>

              <form className="settings-form-grid" onSubmit={handleSubmitDetails}>
                <div className="field">
                  <label htmlFor="details_qty">Qty</label>
                  <input
                    id="details_qty"
                    ref={detailsQtyRef}
                    type="number"
                    min="1"
                    step="1"
                    value={detailsForm.qty}
                    onChange={(event) => setDetailsForm((current) => ({ ...current, qty: event.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="details_cost">Cost</label>
                  <input
                    id="details_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailsForm.costPrice}
                    onChange={(event) => setDetailsForm((current) => ({ ...current, costPrice: event.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="details_selling">Selling Price</label>
                  <input
                    id="details_selling"
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailsForm.sellingPrice}
                    onChange={(event) => setDetailsForm((current) => ({ ...current, sellingPrice: event.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="details_expiration">Expiration (Optional)</label>
                  <input
                    id="details_expiration"
                    type="date"
                    value={detailsForm.expiration}
                    onChange={(event) => setDetailsForm((current) => ({ ...current, expiration: event.target.value }))}
                  />
                </div>

                <div className="settings-actions field--full">
                  <ThemedButton type="button" variant="secondary" onClick={handleCloseDetailsModal} disabled={isSubmitting}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isSubmitting}>
                    <ButtonLabel icon="save">{isSubmitting ? 'Saving...' : 'Save Details'}</ButtonLabel>
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : null}

      {isAddProductModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card terminal-delete-modal">
              <div className="panel-header">
                <div>
                  <h2>Add Product</h2>
                  <p>No matching barcode was found in products. Add the product here without leaving this page.</p>
                </div>
              </div>

              <form className="settings-form-grid settings-form-grid--single-column" onSubmit={handleAddProductSubmit}>
                <div className="field">
                  <label htmlFor="add_product_barcode">Barcode</label>
                  <div className="barcode-input-wrap">
                    <input
                      id="add_product_barcode"
                      value={addProductForm.product_barcode}
                      onChange={(event) => {
                        setAddProductBarcodeCheckState('idle')
                        setError('')
                        setAddProductForm((current) => ({ ...current, product_barcode: event.target.value }))
                      }}
                      onBlur={handleAddProductBarcodeBlur}
                    />
                    {addProductBarcodeCheckState === 'available' ? (
                      <span className="barcode-status-icon barcode-status-icon--ok" aria-label="Barcode available" title="Barcode available">
                        ✓
                      </span>
                    ) : null}
                    {addProductBarcodeCheckState === 'duplicate' ? (
                      <span className="barcode-status-icon barcode-status-icon--bad" aria-label="Barcode already exists" title="Barcode already exists">
                        ✕
                      </span>
                    ) : null}
                  </div>
                  <p className="field-hint">
                    {addProductBarcodeCheckState === 'checking'
                      ? 'Checking barcode...'
                      : addProductBarcodeCheckState === 'duplicate'
                        ? 'This barcode already exists.'
                        : 'Enter a unique barcode to continue.'}
                  </p>
                </div>

                <div className="field">
                  <label htmlFor="add_product_name">Product Name</label>
                  <input
                    ref={addProductNameRef}
                    id="add_product_name"
                    value={addProductForm.product_name}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, product_name: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                </div>

                <div className="field">
                  <label htmlFor="add_product_category">Category</label>
                  <input
                    id="add_product_category"
                    list="add-product-category-options"
                    value={addProductForm.category}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, category: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                  <datalist id="add-product-category-options">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>

                <div className="field">
                  <label htmlFor="add_product_brand">Brand</label>
                  <input
                    id="add_product_brand"
                    list="add-product-brand-options"
                    value={addProductForm.brand}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, brand: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                  <datalist id="add-product-brand-options">
                    {brands.map((brand) => (
                      <option key={brand} value={brand} />
                    ))}
                  </datalist>
                </div>

                <div className="field">
                  <label htmlFor="add_product_unit">Unit</label>
                  <input
                    id="add_product_unit"
                    list="add-product-unit-options"
                    value={addProductForm.unit}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, unit: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                  <datalist id="add-product-unit-options">
                    {units.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </div>

                <div className="field">
                  <label htmlFor="add_product_rop">Re-Order Point</label>
                  <input
                    id="add_product_rop"
                    type="number"
                    step="1"
                    min="0"
                    value={addProductForm.rop}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, rop: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                </div>

                <div className="settings-actions field--full">
                  <ThemedButton type="button" variant="secondary" onClick={handleCloseAddProductModal} disabled={isCreatingProduct}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isCreatingProduct}>
                    <ButtonLabel icon="save">{isCreatingProduct ? 'Saving...' : 'Save Product'}</ButtonLabel>
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : null}

      {isDeleteConfirmOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card terminal-delete-modal">
              <div className="panel-header">
                <div>
                  <h2>Delete Item</h2>
                  <p>
                    Delete barcode {rowToDelete?.BARCODE || ''} from stock batch template?
                  </p>
                </div>
              </div>

              <div className="settings-actions">
                <ThemedButton
                  type="button"
                  variant="secondary"
                  onClick={handleCloseDeleteConfirm}
                  disabled={isDeletingRow}
                >
                  <ButtonLabel icon="cancel">No</ButtonLabel>
                </ThemedButton>
                <ThemedButton
                  type="button"
                  variant="primary"
                  onClick={() => void handleConfirmDelete()}
                  disabled={isDeletingRow}
                >
                  <ButtonLabel icon="delete">{isDeletingRow ? 'Deleting...' : 'Yes'}</ButtonLabel>
                </ThemedButton>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {isModifyModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card terminal-delete-modal">
              <div className="panel-header">
                <div>
                  <h2>Modify Item</h2>
                  <p>Update Qty, Cost, Selling Price, and optional Expiration for barcode {rowToModify?.BARCODE || ''}.</p>
                </div>
              </div>

              <form className="settings-form-grid" onSubmit={handleSubmitModify}>
                <div className="field">
                  <label htmlFor="modify_qty">Qty</label>
                  <input
                    id="modify_qty"
                    type="number"
                    min="1"
                    step="1"
                    value={modifyForm.qty}
                    onChange={(event) => setModifyForm((current) => ({ ...current, qty: event.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="modify_cost">Cost</label>
                  <input
                    id="modify_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={modifyForm.costPrice}
                    onChange={(event) => setModifyForm((current) => ({ ...current, costPrice: event.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="modify_selling">Selling Price</label>
                  <input
                    id="modify_selling"
                    type="number"
                    min="0"
                    step="0.01"
                    value={modifyForm.sellingPrice}
                    onChange={(event) => setModifyForm((current) => ({ ...current, sellingPrice: event.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="modify_expiration">Expiration (Optional)</label>
                  <input
                    id="modify_expiration"
                    type="date"
                    value={modifyForm.expiration}
                    onChange={(event) => setModifyForm((current) => ({ ...current, expiration: event.target.value }))}
                  />
                </div>

                <div className="settings-actions field--full">
                  <ThemedButton type="button" variant="secondary" onClick={handleCloseModifyModal} disabled={isModifyingRow}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isModifyingRow}>
                    <ButtonLabel icon="save">{isModifyingRow ? 'Saving...' : 'Save Changes'}</ButtonLabel>
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : null}

      {isSearchModalOpen ? (
        <div className="terminal-modal-backdrop stock-batch-search-backdrop" role="presentation">
          <div
            className="terminal-modal stock-batch-search-shell"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <article className="panel settings-card stock-batch-search-modal">
              <div className="panel-header">
                <div>
                  <h2>Search Product</h2>
                  <p>Find a product from the products table and select it to fill barcode input.</p>
                </div>
              </div>

              <div className="field">
                <label htmlFor="stock-batch-search-keyword">Search keyword</label>
                <input
                  id="stock-batch-search-keyword"
                  type="search"
                  placeholder="Search by barcode, name, category, brand, unit"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                />
              </div>

              <div className="stock-batch-search-filters">
                <label className="field" htmlFor="stock-batch-search-category">
                  <span>Category</span>
                  <select
                    id="stock-batch-search-category"
                    value={searchCategoryFilter}
                    onChange={(event) => setSearchCategoryFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    {searchCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="stock-batch-search-brand">
                  <span>Brand</span>
                  <select
                    id="stock-batch-search-brand"
                    value={searchBrandFilter}
                    onChange={(event) => setSearchBrandFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    {searchBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {isLoadingSearchProducts ? <div className="empty-state">Loading products...</div> : null}
              {!isLoadingSearchProducts && searchProducts.length === 0 ? (
                <div className="empty-state">No products found.</div>
              ) : null}
              {!isLoadingSearchProducts && searchProducts.length > 0 && filteredSearchProducts.length === 0 ? (
                <div className="empty-state">No products match your search.</div>
              ) : null}

              {!isLoadingSearchProducts && visibleSearchProducts.length > 0 ? (
                <div className="stock-batch-search-table-wrap">
                  <table className="data-table data-table--stock-batch-search">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Barcode</th>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Brand</th>
                        <th>Unit</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSearchProducts.map((product) => (
                        <tr key={product.product_id}>
                          <td>
                            {product.product_image_path ? (
                              <button
                                type="button"
                                className="product-image-trigger"
                                onClick={() => handleOpenImagePreview(product.product_image_path || '', product.product_name || product.product_barcode || 'Product image')}
                                aria-label="Preview product image"
                              >
                                <img
                                  src={product.product_image_path}
                                  alt={product.product_name || product.product_barcode || 'Product image'}
                                  className="product-table-image"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <span className="product-table-image-empty">-</span>
                            )}
                          </td>
                          <td>{product.product_barcode || ''}</td>
                          <td>{product.product_name || ''}</td>
                          <td>{product.category || ''}</td>
                          <td>{product.brand || ''}</td>
                          <td>{product.unit || ''}</td>
                          <td>
                            <button
                              type="button"
                              className="terminal-action stock-batch-modify-button"
                              onClick={() => handleSelectSearchProduct(product)}
                            >
                              <ButtonLabel icon="check">Select</ButtonLabel>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="settings-actions">
                <ThemedButton type="button" variant="secondary" onClick={handleCloseSearchModal}>
                  <ButtonLabel icon="close">Close</ButtonLabel>
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
      title="Add Stock Batch"
      description="Enter a product barcode to auto-match Products table and append into product_batches_template."
      hideTopbar
    >
      {content}
    </AdminShell>
  )
}

export default AddStockBatchPage
