import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import AdminShell from '../components/AdminShell'
import { ButtonLabel, ButtonIcon } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch, resolveAssetUrl } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'
import {
  allowedLogoAccept,
  allowedLogoHint,
  getLogoDropzoneStatus,
  handleLogoDragLeave,
  handleLogoDragOver,
  handleLogoDrop,
  handleLogoDropzoneKeyDown,
  validateLogoFile,
} from '../lib/businessProfile'

type PrintLogoAlign = 'left' | 'center' | 'right'

type ReceiptHeading = {
  id: number | null
  business_logo_path: string
  developer: string
  accreditation_no: string
  valid_start: string
  valid_until: string
  softwareversion: string
  contactdetail: string
  developer_logo_path: string
  print_logo_width: string
  print_logo_align: PrintLogoAlign
  print_logo_enabled: boolean
}

const initialForm: ReceiptHeading = {
  id: null,
  business_logo_path: '',
  developer: '',
  accreditation_no: '',
  valid_start: '',
  valid_until: '',
  softwareversion: '',
  contactdetail: '',
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
    business_logo_path: String(data.business_logo_path || ''),
    developer: String(data.developer || ''),
    accreditation_no: String(data.accreditation_no || ''),
    valid_start: toInputDate(data.valid_start),
    valid_until: toInputDate(data.valid_until),
    softwareversion: String(data.softwareversion || ''),
    contactdetail: String(data.contactdetail || ''),
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

function buildReceiptHeadingFormData(
  form: ReceiptHeading,
  files?: { developerLogoFile?: File | null },
): FormData {
  const payload = new FormData()
  payload.append('id', String(form.id || ''))
  payload.append('developer', form.developer)
  payload.append('accreditation_no', form.accreditation_no)
  payload.append('valid_start', form.valid_start)
  payload.append('valid_until', form.valid_until)
  payload.append('softwareversion', form.softwareversion)
  payload.append('contactdetail', form.contactdetail)
  payload.append('developer_logo_path', form.developer_logo_path)
  payload.append('print_logo_width', String(normalizePrintLogoWidth(form.print_logo_width)))
  payload.append('print_logo_align', form.print_logo_align)
  payload.append('print_logo_enabled', form.print_logo_enabled ? '1' : '0')

  if (files?.developerLogoFile) {
    payload.append('developer_logo', files.developerLogoFile)
  }

  return payload
}

function ReceiptHeadingPage() {
  usePageVisitAudit(AUDIT_PAGES.RECEIPT_HEADING)
  const [form, setForm] = useState<ReceiptHeading>({ ...initialForm })
  const [developerLogoFile, setDeveloperLogoFile] = useState<File | null>(null)
  const [isDeveloperLogoDragOver, setIsDeveloperLogoDragOver] = useState(false)
  const [developerLogoPreview, setDeveloperLogoPreview] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingDeveloperLogo, setIsUploadingDeveloperLogo] = useState(false)
  const [isPrintLogoModalOpen, setIsPrintLogoModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const developerLogoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadReceiptHeading()
  }, [])

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
      setDeveloperLogoFile(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load receipt settings.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleDeveloperLogoSelected(file: File | null) {
    if (!file) {
      setDeveloperLogoFile(null)
      return
    }

    const validationError = validateLogoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSuccess('')
    setDeveloperLogoFile(file)
    void uploadDeveloperLogo(file)
  }

  async function uploadDeveloperLogo(file: File) {
    try {
      setIsUploadingDeveloperLogo(true)
      setError('')

      const payload = buildReceiptHeadingFormData(form, { developerLogoFile: file })
      const response = await apiFetch<{ data: Record<string, unknown>; message: string }>('/api/receipt-heading', {
        method: 'PUT',
        body: payload,
        audit: {
          page: AUDIT_PAGES.RECEIPT_HEADING,
          action: 'UPDATE_DEVELOPER_LOGO',
          description: buildAuditDescription(
            AUDIT_PAGES.RECEIPT_HEADING,
            `Updated developer logo for "${form.developer.trim() || 'receipt settings'}".`,
          ),
          tableName: 'receipt_heading',
        },
      })

      const nextForm = mapResponseToForm(response.data)
      setForm(nextForm)
      setDeveloperLogoFile(null)
      if (developerLogoInputRef.current) {
        developerLogoInputRef.current.value = ''
      }
      setSuccess(response.message || 'Developer logo updated.')
    } catch (uploadError) {
      setDeveloperLogoFile(null)
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload developer logo.')
    } finally {
      setIsUploadingDeveloperLogo(false)
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleDeveloperLogoChange(event: ChangeEvent<HTMLInputElement>) {
    handleDeveloperLogoSelected(event.target.files?.[0] || null)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.developer.trim()) {
      setError('Developer is required.')
      return
    }

    try {
      setIsSaving(true)

      const payload = buildReceiptHeadingFormData(form, { developerLogoFile })

      const response = await apiFetch<{ data: Record<string, unknown>; message: string }>('/api/receipt-heading', {
        method: 'PUT',
        body: payload,
        audit: {
          page: AUDIT_PAGES.RECEIPT_HEADING,
          action: 'UPDATE',
          description: buildAuditDescription(
            AUDIT_PAGES.RECEIPT_HEADING,
            `Saved developer receipt settings for "${form.developer.trim()}".`,
          ),
          tableName: 'receipt_heading',
        },
      })

      const nextForm = mapResponseToForm(response.data)
      setForm(nextForm)
      setDeveloperLogoFile(null)
      setSuccess(response.message || 'Receipt settings saved successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save receipt settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminShell
      title="Business Profile Settings"
      description="Manage developer and receipt print settings for this branch."
      hideTopbar
    >
      <form onSubmit={handleSave} className="settings-stack">
        {isLoading ? <div className="empty-state">Loading receipt settings...</div> : null}
        {error ? <div className="error-state">{error}</div> : null}
        {success ? <div className="success-state">{success}</div> : null}

        <article className="panel settings-panel">
          <div className="audit-card-header">
            <div className="audit-card-header__intro">
              <p className="admin-breadcrumb">Dashboard / Business Profile Settings</p>
              <h1 className="audit-card-title">Developer &amp; Receipt Settings</h1>
              <p className="audit-card-description">
                Business profile fields are managed per branch on the Branches page. Configure developer compliance
                details and receipt print options here.
              </p>
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
              <label htmlFor="developer_logo">Developer logo</label>
              <div className="receipt-logo-row">
                <div
                  className={`receipt-logo-preview-wrap${isUploadingDeveloperLogo ? ' receipt-logo-preview-wrap--uploading' : ''}`}
                >
                  {developerLogoPreview || form.developer_logo_path ? (
                    <img
                      src={developerLogoPreview || resolveAssetUrl(form.developer_logo_path) || ''}
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
                    accept={allowedLogoAccept}
                    onChange={handleDeveloperLogoChange}
                    disabled={isUploadingDeveloperLogo || isSaving}
                  />
                  <div
                    className={`receipt-logo-dropzone${isDeveloperLogoDragOver ? ' is-drag-over' : ''}${isUploadingDeveloperLogo ? ' is-uploading' : ''}`}
                    role="button"
                    tabIndex={isUploadingDeveloperLogo ? -1 : 0}
                    aria-disabled={isUploadingDeveloperLogo}
                    aria-label="Drag and drop developer logo or press Enter to browse"
                    onClick={() => {
                      if (!isUploadingDeveloperLogo) {
                        developerLogoInputRef.current?.click()
                      }
                    }}
                    onKeyDown={(event) => handleLogoDropzoneKeyDown(event, developerLogoInputRef)}
                    onDrop={(event) => {
                      if (!isUploadingDeveloperLogo) {
                        handleLogoDrop(event, setIsDeveloperLogoDragOver, handleDeveloperLogoSelected)
                      }
                    }}
                    onDragOver={(event) => {
                      if (!isUploadingDeveloperLogo) {
                        handleLogoDragOver(event, setIsDeveloperLogoDragOver)
                      }
                    }}
                    onDragLeave={() => handleLogoDragLeave(setIsDeveloperLogoDragOver)}
                  >
                    <strong>Drag and drop logo here</strong>
                    <span>or click to browse</span>
                    <small>
                      {getLogoDropzoneStatus(isUploadingDeveloperLogo, developerLogoFile, form.developer_logo_path)}
                    </small>
                  </div>
                  <p className="field-hint">Accepted: {allowedLogoHint}</p>
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

        <div className="settings-actions">
          <ThemedButton type="button" variant="secondary" onClick={() => void loadReceiptHeading()} disabled={isSaving}>
            <ButtonLabel icon="reload">Reload</ButtonLabel>
          </ThemedButton>
          <ThemedButton type="submit" variant="primary" disabled={isSaving || isLoading || isUploadingDeveloperLogo}>
            <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Save settings'}</ButtonLabel>
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
                <p>Uses the business logo configured on the Branches page for this branch.</p>
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
              {form.print_logo_enabled && form.business_logo_path ? (
                <div className="receipt-logo-print-preview" style={{ textAlign: form.print_logo_align }}>
                  <img
                    src={resolveAssetUrl(form.business_logo_path) || ''}
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
