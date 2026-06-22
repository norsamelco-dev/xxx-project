import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import AdminShell from '../components/AdminShell'
import { ButtonLabel, ButtonIcon } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'

const vatTypeOptions = ['VAT REG TIN', 'VAT-EXEMPT TIN'] as const
const priceVatModeOptions = [
  { value: 'INCLUSIVE', label: 'VAT Inclusive' },
  { value: 'EXCLUSIVE', label: 'VAT Exclusive' },
] as const
const allowedLogoMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const maxLogoBytes = 2 * 1024 * 1024

type PrintLogoAlign = 'left' | 'center' | 'right'

type ReceiptHeading = {
  id: number | null
  busi_name: string
  busi_addr: string
  busi_owner: string
  busi_vat_type: string
  busi_tin: string
  vat_rate: string
  price_vat_mode: string
  developer: string
  accreditation_no: string
  valid_start: string
  valid_until: string
  softwareversion: string
  contactdetail: string
  business_logo_path: string
  developer_logo_path: string
  print_logo_width: string
  print_logo_align: PrintLogoAlign
  print_logo_enabled: boolean
}

const initialForm: ReceiptHeading = {
  id: null,
  busi_name: '',
  busi_addr: '',
  busi_owner: '',
  busi_vat_type: '',
  busi_tin: '',
  vat_rate: '',
  price_vat_mode: 'INCLUSIVE',
  developer: '',
  accreditation_no: '',
  valid_start: '',
  valid_until: '',
  softwareversion: '',
  contactdetail: '',
  business_logo_path: '',
  developer_logo_path: '',
  print_logo_width: '240',
  print_logo_align: 'center',
  print_logo_enabled: true,
}

function normalizePrintLogoAlign(value: unknown): PrintLogoAlign {
  const align = String(value || 'center').trim().toLowerCase()
  if (align === 'left' || align === 'right') {
    return align
  }
  return 'center'
}

function normalizePrintLogoWidth(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 240
  }
  return Math.max(80, Math.min(384, Math.round(parsed)))
}

function toInputDate(value: unknown) {
  if (!value) {
    return ''
  }

  const text = String(value)
  return text.length >= 10 ? text.slice(0, 10) : text
}

function mapResponseToForm(data: Record<string, unknown> | null): ReceiptHeading {
  if (!data) {
    return { ...initialForm }
  }

  return {
    id: Number(data.id) || null,
    busi_name: String(data.busi_name || ''),
    busi_addr: String(data.busi_addr || ''),
    busi_owner: String(data.busi_owner || ''),
    busi_vat_type: String(data.busi_vat_type || ''),
    busi_tin: String(data.busi_tin || ''),
    vat_rate: data.vat_rate === null || data.vat_rate === undefined ? '' : String(data.vat_rate),
    price_vat_mode: String(data.price_vat_mode || 'INCLUSIVE').toUpperCase() === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE',
    developer: String(data.developer || ''),
    accreditation_no: String(data.accreditation_no || ''),
    valid_start: toInputDate(data.valid_start),
    valid_until: toInputDate(data.valid_until),
    softwareversion: String(data.softwareversion || ''),
    contactdetail: String(data.contactdetail || ''),
    business_logo_path: String(data.business_logo_path || ''),
    developer_logo_path: String(data.developer_logo_path || ''),
    print_logo_width: String(normalizePrintLogoWidth(data.print_logo_width)),
    print_logo_align: normalizePrintLogoAlign(data.print_logo_align),
    print_logo_enabled:
      data.print_logo_enabled === undefined || data.print_logo_enabled === null
        ? true
        : data.print_logo_enabled === true ||
          data.print_logo_enabled === 1 ||
          data.print_logo_enabled === '1',
  }
}

function ReceiptHeadingPage() {
  usePageVisitAudit(AUDIT_PAGES.RECEIPT_HEADING)
  const [form, setForm] = useState<ReceiptHeading>({ ...initialForm })
  const [businessLogoFile, setBusinessLogoFile] = useState<File | null>(null)
  const [developerLogoFile, setDeveloperLogoFile] = useState<File | null>(null)
  const [isBusinessLogoDragOver, setIsBusinessLogoDragOver] = useState(false)
  const [isDeveloperLogoDragOver, setIsDeveloperLogoDragOver] = useState(false)
  const [businessLogoPreview, setBusinessLogoPreview] = useState('')
  const [developerLogoPreview, setDeveloperLogoPreview] = useState('')
  const [lastVatRegRate, setLastVatRegRate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPrintLogoModalOpen, setIsPrintLogoModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const businessLogoInputRef = useRef<HTMLInputElement | null>(null)
  const developerLogoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadReceiptHeading()
  }, [])

  useEffect(() => {
    if (!businessLogoFile) {
      setBusinessLogoPreview('')
      return undefined
    }

    const objectUrl = URL.createObjectURL(businessLogoFile)
    setBusinessLogoPreview(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [businessLogoFile])

  useEffect(() => {
    if (!developerLogoFile) {
      setDeveloperLogoPreview('')
      return undefined
    }

    const objectUrl = URL.createObjectURL(developerLogoFile)
    setDeveloperLogoPreview(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [developerLogoFile])

  async function loadReceiptHeading() {
    try {
      setError('')
      setSuccess('')
      setIsLoading(true)
      const response = await apiFetch<{ data: Record<string, unknown> | null }>('/api/receipt-heading')
      const nextForm = mapResponseToForm(response.data)
      setForm(nextForm)
      setBusinessLogoFile(null)
      setDeveloperLogoFile(null)

      if (nextForm.busi_vat_type === 'VAT REG TIN') {
        setLastVatRegRate(nextForm.vat_rate)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load business profile settings.')
    } finally {
      setIsLoading(false)
    }
  }

  function validateLogoFile(file: File) {
    if (!allowedLogoMimeTypes.has(file.type)) {
      setError('Logo must be PNG, JPG, JPEG, or WEBP.')
      return false
    }

    if (file.size > maxLogoBytes) {
      setError('Logo file must be 2 MB or less.')
      return false
    }

    return true
  }

  function handleBusinessLogoSelected(file: File | null) {
    if (!file) {
      setBusinessLogoFile(null)
      return
    }

    if (!validateLogoFile(file)) {
      return
    }

    setError('')
    setBusinessLogoFile(file)
  }

  function handleDeveloperLogoSelected(file: File | null) {
    if (!file) {
      setDeveloperLogoFile(null)
      return
    }

    if (!validateLogoFile(file)) {
      return
    }

    setError('')
    setDeveloperLogoFile(file)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target

    if (name === 'vat_rate') {
      setLastVatRegRate(value)
    }

    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleBusinessLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    handleBusinessLogoSelected(file)
  }

  function handleDeveloperLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    handleDeveloperLogoSelected(file)
  }

  function handleLogoDrop(
    event: DragEvent<HTMLDivElement>,
    setDragOver: (value: boolean) => void,
    onSelect: (file: File | null) => void,
  ) {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0] || null
    onSelect(file)
  }

  function handleLogoDragOver(event: DragEvent<HTMLDivElement>, setDragOver: (value: boolean) => void) {
    event.preventDefault()
    setDragOver(true)
  }

  function handleLogoDragLeave(setDragOver: (value: boolean) => void) {
    setDragOver(false)
  }

  function handleLogoDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>, inputRef: RefObject<HTMLInputElement | null>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  function handleVatTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const { value } = event.target

    if (value === 'VAT-EXEMPT TIN') {
      setLastVatRegRate(form.vat_rate)
    }

    setForm((current) => ({
      ...current,
      busi_vat_type: value,
      vat_rate:
        value === 'VAT-EXEMPT TIN'
          ? '0.00'
          : value === 'VAT REG TIN'
            ? lastVatRegRate
            : current.vat_rate,
    }))
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.busi_name.trim()) {
      setError('Business name is required.')
      return
    }

    if (!form.developer.trim()) {
      setError('Developer is required.')
      return
    }

    try {
      setIsSaving(true)

      const payload = new FormData()
      payload.append('id', String(form.id || ''))
      payload.append('busi_name', form.busi_name)
      payload.append('busi_addr', form.busi_addr)
      payload.append('busi_owner', form.busi_owner)
      payload.append('busi_vat_type', form.busi_vat_type)
      payload.append('busi_tin', form.busi_tin)
      payload.append('vat_rate', form.vat_rate.trim() === '' ? '' : String(Number(form.vat_rate)))
      payload.append('price_vat_mode', form.busi_vat_type === 'VAT-EXEMPT TIN' ? 'INCLUSIVE' : form.price_vat_mode)
      payload.append('developer', form.developer)
      payload.append('accreditation_no', form.accreditation_no)
      payload.append('valid_start', form.valid_start)
      payload.append('valid_until', form.valid_until)
      payload.append('softwareversion', form.softwareversion)
      payload.append('contactdetail', form.contactdetail)
      payload.append('business_logo_path', form.business_logo_path)
      payload.append('developer_logo_path', form.developer_logo_path)
      payload.append('print_logo_width', String(normalizePrintLogoWidth(form.print_logo_width)))
      payload.append('print_logo_align', form.print_logo_align)
      payload.append('print_logo_enabled', form.print_logo_enabled ? '1' : '0')

      if (businessLogoFile) {
        payload.append('business_logo', businessLogoFile)
      }

      if (developerLogoFile) {
        payload.append('developer_logo', developerLogoFile)
      }

      const response = await apiFetch<{ data: Record<string, unknown>; message: string }>('/api/receipt-heading', {
        method: 'PUT',
        body: payload,
        audit: {
          page: AUDIT_PAGES.RECEIPT_HEADING,
          action: 'UPDATE',
          description: buildAuditDescription(
            AUDIT_PAGES.RECEIPT_HEADING,
            `Saved business profile settings for "${form.busi_name.trim()}".`,
          ),
          tableName: 'receipt_heading',
        },
      })

      const nextForm = mapResponseToForm(response.data)
      setForm(nextForm)
      setBusinessLogoFile(null)
      setDeveloperLogoFile(null)
      setSuccess(response.message || 'Business profile settings saved successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save business profile settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminShell
      title="Business Profile Settings"
      description="Manage business and developer details used in printed receipts."
      hideTopbar
    >
      <form onSubmit={handleSave} className="settings-stack">
        {isLoading ? <div className="empty-state">Loading business profile settings...</div> : null}
        {error ? <div className="error-state">{error}</div> : null}
        {success ? <div className="success-state">{success}</div> : null}

        <div className="settings-grid settings-grid--receipt-profile">
          <article className="panel settings-panel">
            <div className="audit-card-header">
              <div className="audit-card-header__intro">
                <p className="admin-breadcrumb">Dashboard / Business Profile Settings</p>
                <h1 className="audit-card-title">Business Profile Settings</h1>
                <p className="audit-card-description">Manage business and developer details used in printed receipts.</p>
              </div>
              <button
                type="button"
                className="receipt-print-settings-trigger"
                aria-label="Print logo on receipts settings"
                title="Print logo on receipts"
                onClick={() => setIsPrintLogoModalOpen(true)}
              >
                <ButtonIcon name="printer" />
              </button>
            </div>

            <div className="settings-form-grid">
              <div className="field field--full receipt-logo-field">
                <label htmlFor="business_logo">Business logo</label>
                <div className="receipt-logo-row">
                  <div className="receipt-logo-preview-wrap">
                    {businessLogoPreview || form.business_logo_path ? (
                      <img
                        src={businessLogoPreview || form.business_logo_path}
                        alt="Business logo preview"
                        className="receipt-logo-preview"
                      />
                    ) : (
                      <div className="receipt-logo-placeholder">No logo selected</div>
                    )}
                  </div>
                  <div className="receipt-logo-picker">
                    <input
                      ref={businessLogoInputRef}
                      className="receipt-logo-file-input"
                      id="business_logo"
                      name="business_logo"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleBusinessLogoChange}
                    />
                    <div
                      className={`receipt-logo-dropzone${isBusinessLogoDragOver ? ' is-drag-over' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label="Drag and drop business logo or press Enter to browse"
                      onClick={() => businessLogoInputRef.current?.click()}
                      onKeyDown={(event) => handleLogoDropzoneKeyDown(event, businessLogoInputRef)}
                      onDrop={(event) => handleLogoDrop(event, setIsBusinessLogoDragOver, handleBusinessLogoSelected)}
                      onDragOver={(event) => handleLogoDragOver(event, setIsBusinessLogoDragOver)}
                      onDragLeave={() => handleLogoDragLeave(setIsBusinessLogoDragOver)}
                    >
                      <strong>Drag and drop logo here</strong>
                      <span>or click to browse</span>
                      <small>{businessLogoFile ? businessLogoFile.name : 'No new file selected'}</small>
                    </div>
                    <p className="field-hint">Accepted: png, jpg, jpeg, webp. Max size: 2 MB.</p>
                  </div>
                </div>
              </div>
              <div className="field field--full">
                <label htmlFor="busi_name">Business name</label>
                <input id="busi_name" name="busi_name" value={form.busi_name} onChange={handleChange} />
              </div>
              <div className="field field--full">
                <label htmlFor="busi_addr">Business address</label>
                <input id="busi_addr" name="busi_addr" value={form.busi_addr} onChange={handleChange} />
              </div>
              <div className="field">
                <label htmlFor="busi_owner">Business owner</label>
                <input id="busi_owner" name="busi_owner" value={form.busi_owner} onChange={handleChange} />
              </div>
              <div className="field">
                <label htmlFor="busi_tin">TIN</label>
                <input id="busi_tin" name="busi_tin" value={form.busi_tin} onChange={handleChange} />
              </div>
              <div className="field">
                <label htmlFor="busi_vat_type">VAT type</label>
                <select id="busi_vat_type" name="busi_vat_type" value={form.busi_vat_type} onChange={handleVatTypeChange}>
                  <option value="">Select VAT type</option>
                  {vatTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="vat_rate">VAT rate</label>
                <input
                  id="vat_rate"
                  name="vat_rate"
                  type="number"
                  step="0.01"
                  value={form.vat_rate}
                  onChange={handleChange}
                  disabled={form.busi_vat_type === 'VAT-EXEMPT TIN'}
                />
              </div>
              <div className="field">
                <label htmlFor="price_vat_mode">Price VAT mode</label>
                <select
                  id="price_vat_mode"
                  name="price_vat_mode"
                  value={form.price_vat_mode}
                  onChange={handleChange}
                  disabled={form.busi_vat_type === 'VAT-EXEMPT TIN'}
                >
                  {priceVatModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field--full">
                {form.busi_vat_type === 'VAT-EXEMPT TIN' ? (
                  <p className="field-hint">
                    Price VAT mode does not apply when the business is VAT-exempt. Product prices are treated as
                    non-VAT amounts at checkout.
                  </p>
                ) : (
                  <>
                    <p className="field-hint">
                      <strong>VAT Inclusive:</strong> Product prices already include VAT. The POS extracts VAT from the
                      selling price; the customer pays the listed price as the grand total.
                    </p>
                    <p className="field-hint">
                      <strong>VAT Exclusive:</strong> Product prices are before VAT. The POS adds VAT on top at
                      checkout, so the grand total is higher than the sum of listed prices.
                    </p>
                    <p className="field-hint">
                      Currently selected:{' '}
                      {form.price_vat_mode === 'EXCLUSIVE'
                        ? 'VAT Exclusive — VAT is added to product prices at checkout.'
                        : 'VAT Inclusive — product prices already include VAT.'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </article>

          <article className="panel settings-panel">
            <div className="audit-card-header">
              <div className="audit-card-header__intro">
                <p className="admin-breadcrumb settings-panel__breadcrumb-spacer" aria-hidden="true">
                  &nbsp;
                </p>
                <h1 className="audit-card-title">Developer Information</h1>
                <p className="audit-card-description">Used for compliance, software accreditation, and support references.</p>
              </div>
              <span
                className="receipt-print-settings-trigger receipt-print-settings-trigger--spacer"
                aria-hidden="true"
              />
            </div>

            <div className="settings-form-grid">
              <div className="field field--full receipt-logo-field">
                <label htmlFor="developer_logo">Developer logo</label>
                <div className="receipt-logo-row">
                  <div className="receipt-logo-preview-wrap">
                    {developerLogoPreview || form.developer_logo_path ? (
                      <img
                        src={developerLogoPreview || form.developer_logo_path}
                        alt="Developer logo preview"
                        className="receipt-logo-preview"
                      />
                    ) : (
                      <div className="receipt-logo-placeholder">No logo selected</div>
                    )}
                  </div>
                  <div className="receipt-logo-picker">
                    <input
                      ref={developerLogoInputRef}
                      className="receipt-logo-file-input"
                      id="developer_logo"
                      name="developer_logo"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleDeveloperLogoChange}
                    />
                    <div
                      className={`receipt-logo-dropzone${isDeveloperLogoDragOver ? ' is-drag-over' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label="Drag and drop developer logo or press Enter to browse"
                      onClick={() => developerLogoInputRef.current?.click()}
                      onKeyDown={(event) => handleLogoDropzoneKeyDown(event, developerLogoInputRef)}
                      onDrop={(event) => handleLogoDrop(event, setIsDeveloperLogoDragOver, handleDeveloperLogoSelected)}
                      onDragOver={(event) => handleLogoDragOver(event, setIsDeveloperLogoDragOver)}
                      onDragLeave={() => handleLogoDragLeave(setIsDeveloperLogoDragOver)}
                    >
                      <strong>Drag and drop logo here</strong>
                      <span>or click to browse</span>
                      <small>{developerLogoFile ? developerLogoFile.name : 'No new file selected'}</small>
                    </div>
                    <p className="field-hint">Accepted: png, jpg, jpeg, webp. Max size: 2 MB.</p>
                  </div>
                </div>
              </div>
              <div className="field field--full">
                <label htmlFor="developer">Developer</label>
                <input id="developer" name="developer" value={form.developer} onChange={handleChange} />
              </div>
              <div className="field field--full">
                <label htmlFor="accreditation_no">Accreditation no.</label>
                <input
                  id="accreditation_no"
                  name="accreditation_no"
                  value={form.accreditation_no}
                  onChange={handleChange}
                />
              </div>
              <div className="field">
                <label htmlFor="valid_start">Valid start</label>
                <input id="valid_start" name="valid_start" type="date" value={form.valid_start} onChange={handleChange} />
              </div>
              <div className="field">
                <label htmlFor="valid_until">Valid until</label>
                <input id="valid_until" name="valid_until" type="date" value={form.valid_until} onChange={handleChange} />
              </div>
              <div className="field">
                <label htmlFor="softwareversion">Software version</label>
                <input id="softwareversion" name="softwareversion" value={form.softwareversion} onChange={handleChange} />
              </div>
              <div className="field">
                <label htmlFor="contactdetail">Contact detail</label>
                <input id="contactdetail" name="contactdetail" value={form.contactdetail} onChange={handleChange} />
              </div>
            </div>
          </article>
        </div>

        <div className="settings-actions">
          <ThemedButton type="button" variant="secondary" onClick={() => void loadReceiptHeading()} disabled={isSaving}>
            <ButtonLabel icon="reload">Reload</ButtonLabel>
          </ThemedButton>
          <ThemedButton type="submit" variant="primary" disabled={isSaving || isLoading}>
            <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Save profile settings'}</ButtonLabel>
          </ThemedButton>
        </div>
      </form>

      {isPrintLogoModalOpen ? (
        <div
          className="terminal-modal-backdrop"
          role="presentation"
          onClick={() => setIsPrintLogoModalOpen(false)}
        >
          <article
            className="panel settings-card terminal-modal receipt-print-logo-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Print logo on receipts"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <h2>Print logo on receipts</h2>
                <p>Applies to sales receipts, test prints, and X/Z reports on all POS terminals.</p>
              </div>
              <button
                type="button"
                className="receipt-print-settings-trigger"
                aria-label="Close print logo settings"
                onClick={() => setIsPrintLogoModalOpen(false)}
              >
                <ButtonIcon name="close" />
              </button>
            </div>

            <div className="receipt-logo-print-settings receipt-logo-print-settings--modal">
              <label className="receipt-logo-print-settings__toggle">
                <input
                  type="checkbox"
                  checked={form.print_logo_enabled}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, print_logo_enabled: event.target.checked }))
                  }
                />
                <span>Enable logo on print</span>
              </label>
              <div className="settings-form-grid receipt-logo-print-settings__grid">
                <div className="field">
                  <label htmlFor="print_logo_width">Width on 80mm paper (dots)</label>
                  <input
                    id="print_logo_width"
                    name="print_logo_width"
                    type="number"
                    min={80}
                    max={384}
                    step={8}
                    value={form.print_logo_width}
                    disabled={!form.print_logo_enabled}
                    onChange={handleChange}
                  />
                </div>
                <div className="field field--full">
                  <span className="field-label">Position</span>
                  <div className="receipt-logo-align-options" role="radiogroup" aria-label="Logo position">
                    {(['left', 'center', 'right'] as PrintLogoAlign[]).map((align) => (
                      <label key={align} className="receipt-logo-align-option">
                        <input
                          type="radio"
                          name="print_logo_align"
                          value={align}
                          checked={form.print_logo_align === align}
                          disabled={!form.print_logo_enabled}
                          onChange={() => setForm((current) => ({ ...current, print_logo_align: align }))}
                        />
                        <span>{align.charAt(0).toUpperCase() + align.slice(1)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {form.print_logo_enabled && (businessLogoPreview || form.business_logo_path) ? (
                <div className="receipt-logo-print-preview" style={{ textAlign: form.print_logo_align }}>
                  <img
                    src={businessLogoPreview || form.business_logo_path}
                    alt="Print logo preview"
                    className="receipt-logo-print-preview__image"
                    style={{
                      width: `${Math.round((normalizePrintLogoWidth(form.print_logo_width) / 384) * 100)}%`,
                      maxWidth: '100%',
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="settings-actions">
              <ThemedButton type="button" variant="primary" onClick={() => setIsPrintLogoModalOpen(false)}>
                <ButtonLabel icon="check">Done</ButtonLabel>
              </ThemedButton>
            </div>
          </article>
        </div>
      ) : null}
    </AdminShell>
  )
}

export default ReceiptHeadingPage