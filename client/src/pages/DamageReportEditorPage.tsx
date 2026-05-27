import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

type DamageReason = {
  id: number
  reason_code: string
  reason_label: string
}

type DamageReportItem = {
  id: number
  product_id: number | null
  product_name: string
  sku: string
  product_barcode: string
  qty_damaged: number
  damage_reason: string
  remarks: string | null
}

type DamageReport = {
  id: number
  report_number: string
  status: string
  remarks: string | null
  created_by_username: string | null
  created_at: string
  synced_by_username: string | null
  synced_at: string | null
  items: DamageReportItem[]
}

type DamageReportProductRow = {
  product_id: number
  product_barcode: string | null
  product_name: string | null
  category: string | null
  brand: string | null
  unit: string | null
  product_image_path: string | null
  sku: string
  available_qty: number
}

type ProductDetailsContext = {
  barcode: string
  description: string | null
  category: string | null
  brand: string | null
  unit: string | null
  available_qty: number
}

type DamageDetailsForm = {
  qty_damaged: string
  damage_reason: string
  remarks: string
}

type AddProductForm = {
  product_barcode: string
  product_name: string
  category: string
  brand: string
  unit: string
  rop: string
}

type ProductsResponse = {
  categories: string[]
  brands: string[]
  units: string[]
}

type BarcodeExistsResponse = {
  exists: boolean
}

type ProductCreateResponse = {
  message: string
}

type BatchAllocation = {
  product_batch_id: number
  batch_id: string | null
  cost_price: number | null
  qty_before: number
  qty_deducted: number
  qty_after: number
}

type SyncPreviewLine = {
  item_id: number
  product_name: string
  sku: string
  product_barcode: string
  qty_damaged: number
  damage_reason: string
  total_available: number
  insufficient: boolean
  shortfall: number
  can_sync: boolean
  allocations: BatchAllocation[]
}

type SyncPreview = {
  report_id: number
  report_number: string
  lines: SyncPreviewLine[]
  can_sync: boolean
  warnings: Array<{ product_barcode?: string; product_name?: string; message?: string }>
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
  report_number: string
  sync_batch_id: string | null
  synced_by_username: string | null
  synced_at: string
  status: string
  error_summary: string | null
  warnings: Array<{ message?: string }>
  items: SyncLogItem[]
}

type BarcodeCheckState = 'idle' | 'checking' | 'available' | 'duplicate' | 'error'

const initialDamageDetailsForm: DamageDetailsForm = {
  qty_damaged: '1',
  damage_reason: '',
  remarks: '',
}

const initialAddProductForm: AddProductForm = {
  product_barcode: '',
  product_name: '',
  category: '',
  brand: '',
  unit: '',
  rop: '20',
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

function formatBatchDetailsForPdf(batches: SyncLogBatch[]) {
  if (!batches.length) {
    return '-'
  }

  return batches
    .map((batch) => {
      const batchLabel = batch.batch_id || `Batch ${batch.product_batch_id ?? ''}`.trim()
      const cost = Number(batch.cost_price || 0).toFixed(2)
      // Use ASCII-only separators; jsPDF Helvetica cannot render PHP peso sign or arrows.
      return `${batchLabel} | PHP ${cost} | -${batch.qty_deducted} (${batch.qty_before} -> ${batch.qty_after})`
    })
    .join('\n')
}

function sanitizePdfFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'damage-report'
}

function productToDetailsContext(product: DamageReportProductRow): ProductDetailsContext {
  return {
    barcode: String(product.product_barcode || '').trim(),
    description: product.product_name,
    category: product.category,
    brand: product.brand,
    unit: product.unit,
    available_qty: product.available_qty,
  }
}

function DamageReportEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const reportId = Number(id)
  usePageVisitAudit(AUDIT_PAGES.DAMAGE_REPORTS)

  const barcodeInputRef = useRef<HTMLInputElement | null>(null)
  const detailsQtyRef = useRef<HTMLInputElement | null>(null)
  const addProductNameRef = useRef<HTMLInputElement | null>(null)

  const [report, setReport] = useState<DamageReport | null>(null)
  const [reasons, setReasons] = useState<DamageReason[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [catalogProducts, setCatalogProducts] = useState<DamageReportProductRow[]>([])
  const [headerRemarks, setHeaderRemarks] = useState('')
  const [barcode, setBarcode] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingHeader, setIsSavingHeader] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeletingReport, setIsDeletingReport] = useState(false)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [isSyncPreviewLoading, setIsSyncPreviewLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isLoadingSearchProducts, setIsLoadingSearchProducts] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null)
  const [syncPassword, setSyncPassword] = useState('')
  const [expandedPreviewLines, setExpandedPreviewLines] = useState<Set<number>>(new Set())
  const [searchProducts, setSearchProducts] = useState<DamageReportProductRow[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchCategoryFilter, setSearchCategoryFilter] = useState('all')
  const [searchBrandFilter, setSearchBrandFilter] = useState('all')
  const [detailsContext, setDetailsContext] = useState<ProductDetailsContext | null>(null)
  const [detailsForm, setDetailsForm] = useState<DamageDetailsForm>(initialDamageDetailsForm)
  const [addProductForm, setAddProductForm] = useState<AddProductForm>(initialAddProductForm)
  const [addProductBarcodeCheckState, setAddProductBarcodeCheckState] = useState<BarcodeCheckState>('idle')
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [itemToDelete, setItemToDelete] = useState<DamageReportItem | null>(null)
  const [previewImageSrc, setPreviewImageSrc] = useState('')
  const [previewImageAlt, setPreviewImageAlt] = useState('Product image preview')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [receiptHeading, setReceiptHeading] = useState<ReceiptHeadingPublic | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [pdfPaperSize, setPdfPaperSize] = useState<PdfPaperSize>('a4')
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('landscape')

  const isDraft = report?.status === 'draft'
  const isReadOnly = !isDraft

  const reasonOptions = useMemo(() => {
    if (reasons.length) {
      return reasons
    }

    return [
      { id: 1, reason_code: 'rat_damage', reason_label: 'Rat damage' },
      { id: 2, reason_code: 'flood', reason_label: 'Flood' },
      { id: 3, reason_code: 'expired', reason_label: 'Expired' },
      { id: 4, reason_code: 'accident', reason_label: 'Accident' },
      { id: 5, reason_code: 'other', reason_label: 'Other' },
    ]
  }, [reasons])

  const productImageByBarcode = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of catalogProducts) {
      const barcode = String(product.product_barcode || '').trim()
      if (barcode && product.product_image_path) {
        map.set(barcode, product.product_image_path)
      }
    }
    return map
  }, [catalogProducts])

  useEffect(() => {
    if (!Number.isInteger(reportId) || reportId < 1) {
      setError('Invalid damage report id.')
      setIsLoading(false)
      return
    }

    void loadPageData()
    void loadReceiptHeadingPublic()
  }, [reportId])

  async function loadReceiptHeadingPublic() {
    try {
      const response = await apiFetch<{ data: ReceiptHeadingPublic | null }>('/api/receipt-heading/public')
      setReceiptHeading(response.data)
    } catch (_error) {
      setReceiptHeading(null)
    }
  }

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
    if (!isDraft || isLoading) {
      return undefined
    }

    return focusAndSelectBarcodeInput()
  }, [isDraft, isLoading])

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

  async function loadPageData() {
    try {
      setIsLoading(true)
      setError('')

      const [reportResponse, reasonsResponse] = await Promise.all([
        apiFetch<{ data: DamageReport }>(`/api/damage-reports/${reportId}`),
        apiFetch<{ data: DamageReason[] }>('/api/damage-reports/reasons'),
      ])

      setReport(reportResponse.data)
      setHeaderRemarks(reportResponse.data.remarks || '')
      setReasons(reasonsResponse.data || [])

      if (reportResponse.data.status === 'synced') {
        const logsResponse = await apiFetch<{ data: SyncLog[] }>(`/api/damage-reports/${reportId}/sync-logs`)
        setSyncLogs(logsResponse.data || [])
      } else {
        setSyncLogs([])
        await loadCatalogProducts()
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load damage report.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadCatalogProducts() {
    try {
      const response = await apiFetch<{ data: DamageReportProductRow[] }>('/api/damage-reports/products')
      setCatalogProducts(response.data || [])
    } catch (_error) {
      setCatalogProducts([])
    }
  }

  async function loadSearchProducts() {
    try {
      setIsLoadingSearchProducts(true)
      const response = await apiFetch<{ data: DamageReportProductRow[] }>('/api/damage-reports/products')
      setSearchProducts(response.data || [])
      setCatalogProducts(response.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load products for search.')
    } finally {
      setIsLoadingSearchProducts(false)
    }
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

  function openDetailsModal(context: ProductDetailsContext, form: DamageDetailsForm, itemId: number | null = null) {
    setDetailsContext(context)
    setDetailsForm(form)
    setEditingItemId(itemId)
    setIsDetailsModalOpen(true)
  }

  function handleCloseDetailsModal() {
    setIsDetailsModalOpen(false)
    setDetailsContext(null)
    setDetailsForm(initialDamageDetailsForm)
    setEditingItemId(null)
    clearAndRefocusBarcodeInput()
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

  function handleCloseAddProductModal() {
    setIsAddProductModalOpen(false)
    setAddProductForm(initialAddProductForm)
    setAddProductBarcodeCheckState('idle')
    clearAndRefocusBarcodeInput()
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

  async function handleAddProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const isBarcodeAvailable = await validateAddProductBarcode(addProductForm.product_barcode)
    if (!isBarcodeAvailable) {
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
          page: AUDIT_PAGES.DAMAGE_REPORTS,
          action: 'INSERT',
          description: buildAuditDescription(
            AUDIT_PAGES.DAMAGE_REPORTS,
            `Created product "${addProductForm.product_name.trim()}" (barcode ${addProductForm.product_barcode.trim()}) from Damage Report.`,
          ),
          tableName: 'products',
          productBarcode: addProductForm.product_barcode.trim(),
        },
      })

      const createdBarcode = addProductForm.product_barcode.trim()
      setSuccess(response.message || 'Product created successfully.')
      setIsAddProductModalOpen(false)
      setAddProductForm(initialAddProductForm)
      setAddProductBarcodeCheckState('idle')
      await loadCatalogProducts()
      await submitBarcode(createdBarcode)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create product.')
    } finally {
      setIsCreatingProduct(false)
    }
  }

  async function submitBarcode(normalizedBarcode: string) {
    setError('')
    setSuccess('')

    try {
      setIsSubmitting(true)
      const response = await apiFetch<{ data: DamageReportProductRow }>(
        `/api/damage-reports/products/lookup?barcode=${encodeURIComponent(normalizedBarcode)}`,
      )

      openDetailsModal(productToDetailsContext(response.data), initialDamageDetailsForm, null)
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to look up product.'

      if (message.toLowerCase().includes('no matching product found')) {
        await openAddProductModal(normalizedBarcode)
        return
      }

      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleBarcodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedBarcode = barcode.trim()
    if (!normalizedBarcode) {
      setError('Barcode is required.')
      return
    }

    await submitBarcode(normalizedBarcode)
  }

  async function handleSelectSearchProduct(product: DamageReportProductRow) {
    const selectedBarcode = String(product.product_barcode || '').trim()
    setBarcode(selectedBarcode)
    setIsSearchModalOpen(false)

    if (!selectedBarcode) {
      setError('Barcode is required.')
      return
    }

    await submitBarcode(selectedBarcode)
  }

  function handleOpenModifyModal(item: DamageReportItem) {
    openDetailsModal(
      {
        barcode: item.product_barcode,
        description: item.product_name,
        category: null,
        brand: null,
        unit: null,
        available_qty: 0,
      },
      {
        qty_damaged: String(item.qty_damaged),
        damage_reason: item.damage_reason,
        remarks: item.remarks || '',
      },
      item.id,
    )
  }

  async function handleSubmitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!report || !detailsContext?.barcode) {
      setError('No pending product entry was found.')
      return
    }

    if (!detailsForm.qty_damaged.trim() || Number(detailsForm.qty_damaged) < 1) {
      setError('Quantity damaged must be at least 1.')
      return
    }

    if (!detailsForm.damage_reason.trim()) {
      setError('Damage reason is required.')
      return
    }

    const payload = {
      lookup: detailsContext.barcode,
      qty_damaged: Number(detailsForm.qty_damaged),
      damage_reason: detailsForm.damage_reason.trim(),
      remarks: detailsForm.remarks.trim() || null,
    }

    try {
      setIsSubmitting(true)

      if (editingItemId) {
        await apiFetch(`/api/damage-reports/${report.id}/items/${editingItemId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          audit: {
            page: AUDIT_PAGES.DAMAGE_REPORTS,
            action: 'UPDATE',
            description: buildAuditDescription(
              AUDIT_PAGES.DAMAGE_REPORTS,
              `Updated damage item for barcode ${detailsContext.barcode} on report ${report.report_number}.`,
            ),
            tableName: 'damage_report_items',
            productBarcode: detailsContext.barcode,
          },
        })
      } else {
        await apiFetch(`/api/damage-reports/${report.id}/items`, {
          method: 'POST',
          body: JSON.stringify(payload),
          audit: {
            page: AUDIT_PAGES.DAMAGE_REPORTS,
            action: 'INSERT',
            description: buildAuditDescription(
              AUDIT_PAGES.DAMAGE_REPORTS,
              `Added damage item via barcode ${detailsContext.barcode} on report ${report.report_number}.`,
            ),
            tableName: 'damage_report_items',
            productBarcode: detailsContext.barcode,
          },
        })
      }

      setSuccess(editingItemId ? 'Item updated.' : 'Item added.')
      setBarcode('')
      setIsDetailsModalOpen(false)
      setDetailsContext(null)
      setDetailsForm(initialDamageDetailsForm)
      setEditingItemId(null)
      await loadPageData()
      clearAndRefocusBarcodeInput()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save damage item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveHeader() {
    if (!report || !isDraft) {
      return
    }

    try {
      setIsSavingHeader(true)
      setError('')
      setSuccess('')

      const response = await apiFetch<{ data: DamageReport; message: string }>(`/api/damage-reports/${report.id}`, {
        method: 'PUT',
        body: JSON.stringify({ remarks: headerRemarks }),
        audit: {
          page: AUDIT_PAGES.DAMAGE_REPORTS,
          action: 'UPDATE',
          description: buildAuditDescription(
            AUDIT_PAGES.DAMAGE_REPORTS,
            `Updated draft damage report ${report.report_number}.`,
          ),
          tableName: 'damage_reports',
        },
      })

      setReport(response.data)
      setSuccess(response.message || 'Damage report saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save damage report.')
    } finally {
      setIsSavingHeader(false)
    }
  }

  function handleOpenDeleteConfirm(item: DamageReportItem) {
    setItemToDelete(item)
    setIsDeleteConfirmOpen(true)
  }

  function handleCloseDeleteConfirm() {
    setItemToDelete(null)
    setIsDeleteConfirmOpen(false)
    clearAndRefocusBarcodeInput()
  }

  async function handleConfirmDeleteItem() {
    if (!report || !itemToDelete) {
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      await apiFetch(`/api/damage-reports/${report.id}/items/${itemToDelete.id}`, {
        method: 'DELETE',
        audit: {
          page: AUDIT_PAGES.DAMAGE_REPORTS,
          action: 'DELETE',
          description: buildAuditDescription(
            AUDIT_PAGES.DAMAGE_REPORTS,
            `Removed item from draft damage report ${report.report_number}.`,
          ),
          tableName: 'damage_report_items',
          productBarcode: itemToDelete.product_barcode,
        },
      })

      setSuccess('Item removed.')
      handleCloseDeleteConfirm()
      await loadPageData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to remove item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteReport() {
    if (!report || !isDraft) {
      return
    }

    if (!window.confirm(`Delete draft report ${report.report_number}?`)) {
      return
    }

    try {
      setIsDeletingReport(true)
      setError('')

      await apiFetch(`/api/damage-reports/${report.id}`, {
        method: 'DELETE',
        audit: {
          page: AUDIT_PAGES.DAMAGE_REPORTS,
          action: 'DELETE',
          description: buildAuditDescription(
            AUDIT_PAGES.DAMAGE_REPORTS,
            `Deleted draft damage report ${report.report_number}.`,
          ),
          tableName: 'damage_reports',
        },
      })

      navigate('/damage-reports')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete damage report.')
    } finally {
      setIsDeletingReport(false)
    }
  }

  async function handleOpenSyncModal() {
    if (!report || !isDraft) {
      return
    }

    setError('')
    setSyncPassword('')
    setExpandedPreviewLines(new Set())
    setIsSyncModalOpen(true)
    setIsSyncPreviewLoading(true)

    try {
      const response = await apiFetch<{ data: SyncPreview }>(`/api/damage-reports/${report.id}/sync-preview`)
      setSyncPreview(response.data)

      if (!response.data.lines.length) {
        setIsSyncModalOpen(false)
        setError('Add at least one item before syncing.')
      }
    } catch (previewError) {
      setIsSyncModalOpen(false)
      setError(previewError instanceof Error ? previewError.message : 'Unable to load sync preview.')
    } finally {
      setIsSyncPreviewLoading(false)
    }
  }

  function handleCloseSyncModal() {
    if (isSyncing) {
      return
    }

    setIsSyncModalOpen(false)
    setSyncPreview(null)
    setSyncPassword('')
    clearAndRefocusBarcodeInput()
  }

  async function handleConfirmSync() {
    if (!report || !syncPreview) {
      return
    }

    if (!syncPreview.can_sync) {
      setError('Resolve insufficient stock warnings before syncing.')
      return
    }

    if (!syncPassword.trim()) {
      setError('Password is required to confirm sync.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsSyncing(true)

      const response = await apiFetch<{ data: { report_number: string }; message: string }>(
        `/api/damage-reports/${report.id}/sync`,
        {
          method: 'POST',
          body: JSON.stringify({ password: syncPassword }),
          audit: {
            page: AUDIT_PAGES.DAMAGE_REPORTS,
            action: 'SYNC',
            description: buildAuditDescription(
              AUDIT_PAGES.DAMAGE_REPORTS,
              `Synced damage report ${report.report_number} to inventory.`,
            ),
            tableName: 'damage_reports',
          },
        },
      )

      setSuccess(response.message || 'Damage report synced successfully.')
      setIsSyncModalOpen(false)
      setSyncPreview(null)
      setSyncPassword('')
      await loadPageData()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync damage report.')
    } finally {
      setIsSyncing(false)
    }
  }

  function togglePreviewLine(itemId: number) {
    setExpandedPreviewLines((current) => {
      const next = new Set(current)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  function handleExportPdfClick() {
    if (!report || report.items.length === 0) {
      setError('No damage items are available to export.')
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
    if (!report || report.items.length === 0) {
      setError('No damage items are available to export.')
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
      doc.text('Damage Report', pageWidth / 2, reportTitleY, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const metadataStartY = reportTitleY + 18
      const metadataLines = [
        `Report #: ${report.report_number}`,
        `Status: ${report.status}`,
        `Created By: ${report.created_by_username || '-'}`,
        `Created At: ${formatDateTime(report.created_at) || '-'}`,
        `Synced By: ${report.synced_by_username || '-'}`,
        `Synced At: ${formatDateTime(report.synced_at ?? null) || '-'}`,
        `Remarks: ${report.remarks || headerRemarks || '-'}`,
      ]

      metadataLines.forEach((line, index) => {
        doc.text(line, leftMargin, metadataStartY + index * 14)
      })

      const tableStyles = {
        fontSize: 8,
        cellPadding: 4,
        valign: 'middle' as const,
        lineColor: [224, 229, 236] as [number, number, number],
        lineWidth: 0.5,
      }

      autoTable(doc, {
        startY: metadataStartY + metadataLines.length * 14 + 10,
        head: [['Barcode', 'Product', 'Qty', 'Reason', 'Remarks']],
        body: report.items.map((item) => [
          item.product_barcode || '',
          item.product_name || '',
          String(item.qty_damaged ?? ''),
          item.damage_reason || '',
          item.remarks || '',
        ]),
        theme: 'grid',
        styles: tableStyles,
        headStyles: {
          fillColor: [17, 24, 39],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 251, 253],
        },
      })

      let sectionY = (doc as import('jspdf').jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? metadataStartY + 80
      sectionY += 20

      if (syncLogs.length > 0) {
        for (const log of syncLogs) {
          if (sectionY > doc.internal.pageSize.getHeight() - 120) {
            doc.addPage()
            sectionY = 48
          }

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.text(`Sync Audit - ${log.status}`, leftMargin, sectionY)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          const syncMetaLines = [
            `Synced At: ${formatDateTime(log.synced_at) || '-'}`,
            `Synced By: ${log.synced_by_username || '-'}`,
            log.sync_batch_id ? `Batch Ref: ${log.sync_batch_id}` : null,
            log.error_summary ? `Error: ${log.error_summary}` : null,
          ].filter(Boolean) as string[]

          syncMetaLines.forEach((line, index) => {
            doc.text(line, leftMargin, sectionY + 14 + index * 12)
          })

          autoTable(doc, {
            startY: sectionY + 14 + syncMetaLines.length * 12 + 8,
            head: [['Product', 'Barcode', 'Qty Requested', 'Qty Deducted', 'Reason', 'Batch Details']],
            body: log.items.map((item) => [
              item.product_name || '',
              item.product_barcode || '',
              String(item.qty_requested ?? ''),
              String(item.qty_deducted ?? ''),
              item.damage_reason || '',
              formatBatchDetailsForPdf(item.batches),
            ]),
            theme: 'grid',
            styles: tableStyles,
            headStyles: {
              fillColor: [17, 24, 39],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
            },
            alternateRowStyles: {
              fillColor: [249, 251, 253],
            },
          })

          sectionY = (doc as import('jspdf').jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? sectionY + 40
          sectionY += 20
        }
      }

      addPdfPageNumbers(doc, leftMargin)

      const filename = `damage-report-${sanitizePdfFilename(report.report_number)}.pdf`
      doc.save(filename)

      setSuccess('Damage report PDF exported successfully.')
      setIsPdfModalOpen(false)

      await recordAuditEvent({
        page: AUDIT_PAGES.DAMAGE_REPORTS,
        action: 'EXPORT',
        description: buildAuditDescription(
          AUDIT_PAGES.DAMAGE_REPORTS,
          `Exported damage report PDF for ${report.report_number} (${formatPdfExportLabel(exportOptions)}).`,
        ),
        tableName: 'damage_reports',
      })
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export damage report PDF.')
    } finally {
      setIsExporting(false)
    }
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

  if (isLoading) {
    return (
      <AdminShell title="Damage Report" description="Loading damage report..." hideTopbar>
        <div className="empty-state">Loading damage report...</div>
      </AdminShell>
    )
  }

  if (!report) {
    return (
      <AdminShell title="Damage Report" description="Damage report not found." hideTopbar>
        <div className="empty-state">
          <p>Damage report not found.</p>
          <Link to="/damage-reports" className="button-secondary">
            <ButtonLabel icon="back">Back to Damage Reports</ButtonLabel>
          </Link>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title={`Damage Report ${report.report_number}`}
      description={isDraft ? 'Draft report — scan barcodes to add damaged items, then sync when ready.' : 'Synced report — read only.'}
      hideTopbar
    >
      <section className="settings-stack">
        <article className="surface-card surface-card--wide stock-batch-shell">
          <div className="audit-card-header stock-batch-header">
            <div>
              <p className="admin-breadcrumb">
                <Link to="/damage-reports">Damage Reports</Link> / {report.report_number}
              </p>
              <h1 className="audit-card-title">Damage Report {report.report_number}</h1>
              <p className="audit-card-description">
                Status:{' '}
                <span className={`status-pill status-pill--${report.status === 'synced' ? 'success' : 'pending'}`}>
                  {report.status}
                </span>
                {isDraft
                  ? ' — Scan or type a product barcode to add damaged items, then sync to inventory when ready.'
                  : ' — This report is read-only after sync.'}
              </p>
            </div>
            <div className="audit-card-actions">
              {isDraft ? (
                <>
                  <ThemedButton type="button" variant="secondary" onClick={() => void handleSaveHeader()} disabled={isSavingHeader}>
                    <ButtonLabel icon="save">{isSavingHeader ? 'Saving...' : 'Save Draft'}</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton
                    type="button"
                    variant="secondary"
                    onClick={() => void handleDeleteReport()}
                    disabled={isDeletingReport}
                  >
                    <ButtonLabel icon="delete">Delete Draft</ButtonLabel>
                  </ThemedButton>
                </>
              ) : (
                <button
                  type="button"
                  className="topbar-button topbar-button--ghost audit-export-button"
                  onClick={handleExportPdfClick}
                  disabled={isExporting || report.items.length === 0}
                >
                  <ButtonLabel icon="export">{isExporting ? 'Exporting PDF...' : 'Export to PDF'}</ButtonLabel>
                </button>
              )}
              <Link to="/damage-reports" className="button-secondary">
                <ButtonLabel icon="back">Back to List</ButtonLabel>
              </Link>
            </div>
          </div>

          {error ? <div className="error-state">{error}</div> : null}
          {success ? <div className="success-state">{success}</div> : null}

          <div className="damage-report-meta-grid">
            <div>
              <strong>Created By</strong>
              <p>{report.created_by_username || '—'}</p>
            </div>
            <div>
              <strong>Created At</strong>
              <p>{formatDateTime(report.created_at)}</p>
            </div>
            <div>
              <strong>Synced By</strong>
              <p>{report.synced_by_username || '—'}</p>
            </div>
            <div>
              <strong>Synced At</strong>
              <p>{formatDateTime(report.synced_at ?? null)}</p>
            </div>
          </div>

          <label className="field field--full">
            <span>Report Remarks</span>
            <textarea
              value={headerRemarks}
              onChange={(event) => setHeaderRemarks(event.target.value)}
              disabled={isReadOnly}
              rows={2}
              placeholder="Optional notes for this damage report"
            />
          </label>

          {isDraft ? (
            <div className="audit-card-header stock-batch-header damage-report-entry-toolbar">
              <div className="audit-card-actions stock-batch-toolbar">
                <button
                  type="button"
                  className="stock-batch-search-indicator"
                  aria-label="Search product"
                  onClick={() => void handleOpenSearchModal()}
                >
                  <svg viewBox="0 0 24 24" className="stock-batch-search-indicator__icon" focusable="false">
                    <circle cx="11" cy="11" r="6" />
                    <path d="M16 16l4 4" />
                  </svg>
                  <span className="stock-batch-search-indicator__label">Search</span>
                </button>

                <form className="stock-batch-toolbar-form" onSubmit={handleBarcodeSubmit}>
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
          ) : null}

          <section className="stock-batch-board damage-report-items-section">
            <h3>Report Items ({report.items.length})</h3>
            {report.items.length === 0 ? (
              <div className="stock-batch-board-placeholder">NO DAMAGE ITEMS YET. SCAN OR SEARCH A PRODUCT TO BEGIN.</div>
            ) : (
              <div className="stock-batch-table-wrap">
                <table className="data-table data-table--stock-batch">
                  <thead>
                    <tr>
                      <th>IMAGE</th>
                      <th>BARCODE</th>
                      <th>PRODUCT NAME</th>
                      <th>QTY</th>
                      <th>REASON</th>
                      <th>REMARKS</th>
                      {isDraft ? <th>ACTIONS</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((item) => {
                      const imagePath = productImageByBarcode.get(item.product_barcode)
                      return (
                        <tr key={item.id}>
                          <td>
                            {imagePath ? (
                              <button
                                type="button"
                                className="product-image-trigger"
                                onClick={() => handleOpenImagePreview(imagePath, item.product_name || item.product_barcode)}
                                aria-label="Preview product image"
                              >
                                <img
                                  src={imagePath}
                                  alt={item.product_name || item.product_barcode}
                                  className="product-table-image"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <span className="product-table-image-empty">-</span>
                            )}
                          </td>
                          <td>{item.product_barcode}</td>
                          <td>{item.product_name}</td>
                          <td>{item.qty_damaged}</td>
                          <td>{item.damage_reason}</td>
                          <td>{item.remarks || ''}</td>
                          {isDraft ? (
                            <td>
                              <div className="table-actions">
                                <button
                                  type="button"
                                  className="terminal-action stock-batch-modify-button"
                                  onClick={() => handleOpenModifyModal(item)}
                                  aria-label="Modify item"
                                  title="Modify item"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="stock-batch-edit-icon">
                                    <path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5z" />
                                    <path d="M13.5 7l3.5 3.5" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="terminal-action stock-batch-delete-button"
                                  onClick={() => handleOpenDeleteConfirm(item)}
                                  aria-label="Delete item"
                                  title="Delete item"
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
                          ) : null}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {isDraft && report.items.length > 0 ? (
            <button
              type="button"
              className="stock-batch-bottom-action button-primary"
              onClick={() => void handleOpenSyncModal()}
              disabled={isSyncPreviewLoading || isSyncing}
            >
              <ButtonLabel icon="sync">Sync to Inventory</ButtonLabel>
            </button>
          ) : null}

          {!isDraft && syncLogs.length > 0 ? (
            <section className="damage-report-sync-logs">
              <h3>Sync Logs</h3>
              {syncLogs.map((log) => (
                <article key={log.id} className="sync-history-group">
                  <header className="sync-history-group-header">
                    <div>
                      <h4>{log.report_number}</h4>
                      <p>
                        {formatDateTime(log.synced_at)} · {log.synced_by_username || 'Unknown'} ·{' '}
                        <span className={`status-pill status-pill--${log.status === 'success' ? 'success' : 'error'}`}>
                          {log.status}
                        </span>
                      </p>
                      {log.error_summary ? <p className="form-message form-message--error">{log.error_summary}</p> : null}
                    </div>
                  </header>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Barcode</th>
                          <th>Qty Deducted</th>
                          <th>Reason</th>
                          <th>Batch Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.product_name}</td>
                            <td>{item.product_barcode}</td>
                            <td>{item.qty_deducted}</td>
                            <td>{item.damage_reason}</td>
                            <td>
                              {item.batches.map((batch) => (
                                <div key={batch.id} className="damage-batch-allocation">
                                  {batch.batch_id || 'Batch'} · ₱{Number(batch.cost_price || 0).toFixed(2)} · -{batch.qty_deducted} ({batch.qty_before} → {batch.qty_after})
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </article>
      </section>

      {isDetailsModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card terminal-delete-modal">
              <div className="panel-header">
                <div>
                  <h2>{editingItemId ? 'Modify Damage Item' : 'Damage Item Details'}</h2>
                  <p>
                    Barcode {detailsContext?.barcode || ''}. Enter quantity damaged, reason, and optional remarks.
                    {detailsContext?.available_qty !== undefined ? ` Available stock: ${detailsContext.available_qty}.` : ''}
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
                  <label htmlFor="damage_details_qty">Qty Damaged</label>
                  <input
                    id="damage_details_qty"
                    ref={detailsQtyRef}
                    type="number"
                    min="1"
                    step="1"
                    value={detailsForm.qty_damaged}
                    onChange={(event) => setDetailsForm((current) => ({ ...current, qty_damaged: event.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="damage_details_reason">Reason for Damage</label>
                  <select
                    id="damage_details_reason"
                    value={detailsForm.damage_reason}
                    onChange={(event) => setDetailsForm((current) => ({ ...current, damage_reason: event.target.value }))}
                  >
                    <option value="">Select reason</option>
                    {reasonOptions.map((reason) => (
                      <option key={reason.reason_code} value={reason.reason_label}>
                        {reason.reason_label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field field--full">
                  <label htmlFor="damage_details_remarks">Remarks (Optional)</label>
                  <input
                    id="damage_details_remarks"
                    type="text"
                    value={detailsForm.remarks}
                    onChange={(event) => setDetailsForm((current) => ({ ...current, remarks: event.target.value }))}
                  />
                </div>

                <div className="settings-actions field--full">
                  <ThemedButton type="button" variant="secondary" onClick={handleCloseDetailsModal} disabled={isSubmitting}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <ButtonLabel icon="save">Saving...</ButtonLabel>
                    ) : editingItemId ? (
                      <ButtonLabel icon="save">Save Changes</ButtonLabel>
                    ) : (
                      <ButtonLabel icon="plus">Add Item</ButtonLabel>
                    )}
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
                  <label htmlFor="damage_add_product_barcode">Barcode</label>
                  <div className="barcode-input-wrap">
                    <input
                      id="damage_add_product_barcode"
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
                  <label htmlFor="damage_add_product_name">Product Name</label>
                  <input
                    ref={addProductNameRef}
                    id="damage_add_product_name"
                    value={addProductForm.product_name}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, product_name: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                </div>

                <div className="field">
                  <label htmlFor="damage_add_product_category">Category</label>
                  <input
                    id="damage_add_product_category"
                    list="damage-add-product-category-options"
                    value={addProductForm.category}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, category: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                  <datalist id="damage-add-product-category-options">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>

                <div className="field">
                  <label htmlFor="damage_add_product_brand">Brand</label>
                  <input
                    id="damage_add_product_brand"
                    list="damage-add-product-brand-options"
                    value={addProductForm.brand}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, brand: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                  <datalist id="damage-add-product-brand-options">
                    {brands.map((brand) => (
                      <option key={brand} value={brand} />
                    ))}
                  </datalist>
                </div>

                <div className="field">
                  <label htmlFor="damage_add_product_unit">Unit</label>
                  <input
                    id="damage_add_product_unit"
                    list="damage-add-product-unit-options"
                    value={addProductForm.unit}
                    onChange={(event) => setAddProductForm((current) => ({ ...current, unit: event.target.value }))}
                    disabled={addProductBarcodeCheckState !== 'available'}
                  />
                  <datalist id="damage-add-product-unit-options">
                    {units.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </div>

                <div className="field">
                  <label htmlFor="damage_add_product_rop">Re-Order Point</label>
                  <input
                    id="damage_add_product_rop"
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
                  <p>Remove barcode {itemToDelete?.product_barcode || ''} from this damage report?</p>
                </div>
              </div>
              <div className="settings-actions">
                <ThemedButton type="button" variant="secondary" onClick={handleCloseDeleteConfirm} disabled={isSubmitting}>
                  <ButtonLabel icon="cancel">No</ButtonLabel>
                </ThemedButton>
                <ThemedButton type="button" variant="primary" onClick={() => void handleConfirmDeleteItem()} disabled={isSubmitting}>
                  <ButtonLabel icon="delete">{isSubmitting ? 'Deleting...' : 'Yes'}</ButtonLabel>
                </ThemedButton>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {isSearchModalOpen ? (
        <div className="terminal-modal-backdrop stock-batch-search-backdrop" role="presentation">
          <div className="terminal-modal stock-batch-search-shell" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card stock-batch-search-modal">
              <div className="panel-header">
                <div>
                  <h2>Search Product</h2>
                  <p>Find a product and select it to fill the barcode input.</p>
                </div>
              </div>

              <div className="field">
                <label htmlFor="damage-search-keyword">Search keyword</label>
                <input
                  id="damage-search-keyword"
                  type="search"
                  placeholder="Search by barcode, name, category, brand, unit"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                />
              </div>

              <div className="stock-batch-search-filters">
                <label className="field" htmlFor="damage-search-category">
                  <span>Category</span>
                  <select id="damage-search-category" value={searchCategoryFilter} onChange={(event) => setSearchCategoryFilter(event.target.value)}>
                    <option value="all">All</option>
                    {searchCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="damage-search-brand">
                  <span>Brand</span>
                  <select id="damage-search-brand" value={searchBrandFilter} onChange={(event) => setSearchBrandFilter(event.target.value)}>
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
              {!isLoadingSearchProducts && searchProducts.length === 0 ? <div className="empty-state">No products found.</div> : null}
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
                        <th>Available</th>
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
                          <td>{product.available_qty}</td>
                          <td>
                            <button type="button" className="terminal-action stock-batch-modify-button" onClick={() => void handleSelectSearchProduct(product)}>
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

      {isSyncModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal stock-batch-sync-shell" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card stock-batch-sync-modal">
              <div className="panel-header">
                <div>
                  <h2>Sync Damage Report</h2>
                  <p>Review LOFO batch allocations before deducting damaged quantities from inventory.</p>
                </div>
              </div>

              {isSyncPreviewLoading ? <div className="empty-state">Loading sync preview...</div> : null}

              {!isSyncPreviewLoading && syncPreview ? (
                <>
                  {!syncPreview.can_sync ? (
                    <div className="form-message form-message--error">
                      Insufficient stock for one or more items. Resolve quantities before syncing.
                    </div>
                  ) : null}

                  <div className="stock-batch-sync-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Barcode</th>
                          <th>Qty</th>
                          <th>Available</th>
                          <th>Status</th>
                          <th>Batches</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncPreview.lines.map((line) => {
                          const isExpanded = expandedPreviewLines.has(line.item_id)
                          return (
                            <tr key={line.item_id}>
                              <td>{line.product_name}</td>
                              <td>{line.product_barcode}</td>
                              <td>{line.qty_damaged}</td>
                              <td>{line.total_available}</td>
                              <td>
                                {line.insufficient ? (
                                  <span className="status-pill status-pill--error">Short {line.shortfall}</span>
                                ) : (
                                  <span className="status-pill status-pill--success">OK</span>
                                )}
                              </td>
                              <td>
                                <button type="button" className="button-secondary button-secondary--compact" onClick={() => togglePreviewLine(line.item_id)}>
                                  <ButtonLabel icon={isExpanded ? 'hide' : 'view'}>
                                    {isExpanded ? 'Hide' : 'Show'} ({line.allocations.length})
                                  </ButtonLabel>
                                </button>
                                {isExpanded ? (
                                  <div className="damage-preview-batches">
                                    {line.allocations.map((batch) => (
                                      <div key={batch.product_batch_id} className="damage-batch-allocation">
                                        {batch.batch_id || `Batch ${batch.product_batch_id}`} · ₱{Number(batch.cost_price || 0).toFixed(2)} · -{batch.qty_deducted} ({batch.qty_before} → {batch.qty_after})
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              <div className="field">
                <label htmlFor="damage_sync_password">Password validation</label>
                <input
                  id="damage_sync_password"
                  name="damage_sync_password"
                  type="password"
                  value={syncPassword}
                  onChange={(event) => setSyncPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={isSyncPreviewLoading || isSyncing}
                />
              </div>

              <div className="settings-actions">
                <ThemedButton type="button" variant="secondary" onClick={handleCloseSyncModal} disabled={isSyncPreviewLoading || isSyncing}>
                  <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                </ThemedButton>
                <ThemedButton
                  type="button"
                  variant="primary"
                  onClick={() => void handleConfirmSync()}
                  disabled={isSyncPreviewLoading || isSyncing || !syncPreview?.can_sync || !syncPassword.trim()}
                >
                  <ButtonLabel icon="sync">{isSyncing ? 'Syncing...' : 'Confirm Sync'}</ButtonLabel>
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
                <ThemedButton type="button" variant="secondary" onClick={handleCloseImagePreview}>
                  <ButtonLabel icon="close">Close</ButtonLabel>
                </ThemedButton>
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {isPdfModalOpen ? (
        <PdfExportSettingsModal
          title="Export Damage Report PDF"
          description="Choose the paper size and orientation before generating the PDF. Landscape is recommended for batch details."
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

export default DamageReportEditorPage
