import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import AdminShell from '../components/AdminShell'
import { ThemedButton } from '../components/ThemedButton'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch, resolveAssetUrl } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'
import {
  allowedLogoAccept,
  allowedLogoHint,
  appendBusinessProfileToFormData,
  applyVatTypeChange,
  getLogoDropzoneStatus,
  handleBusinessFieldChange,
  handleLogoDragLeave,
  handleLogoDragOver,
  handleLogoDrop,
  handleLogoDropzoneKeyDown,
  initialBusinessProfile,
  mapBusinessProfileFromRow,
  priceVatModeOptions,
  validateLogoFile,
  vatTypeOptions,
  type BusinessProfileFields,
} from '../lib/businessProfile'

type BranchRow = {
  branch_id: number
  branch_code: string
  branch_name: string
  address: string | null
  is_active: boolean
  created_at: string | null
} & BusinessProfileFields

type BranchForm = {
  branch_code: string
  branch_name: string
  address: string
  is_active: boolean
} & BusinessProfileFields

const initialForm: BranchForm = {
  branch_code: '',
  branch_name: '',
  address: '',
  is_active: true,
  ...initialBusinessProfile,
}

const initialDeletePasswords = ['', '', '']

function BranchesPage() {
  usePageVisitAudit('Branches')
  const [rows, setRows] = useState<BranchRow[]>([])
  const [form, setForm] = useState<BranchForm>(initialForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BranchRow | null>(null)
  const [deletePasswords, setDeletePasswords] = useState<string[]>(initialDeletePasswords)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [businessLogoFile, setBusinessLogoFile] = useState<File | null>(null)
  const [businessLogoPreview, setBusinessLogoPreview] = useState('')
  const [isBusinessLogoDragOver, setIsBusinessLogoDragOver] = useState(false)
  const [lastVatRegRate, setLastVatRegRate] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const businessLogoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadRows()
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

  async function loadRows() {
    try {
      setError('')
      setIsLoading(true)
      const response = await apiFetch<{ data: BranchRow[] }>('/api/branches')
      setRows(response.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load branches.')
    } finally {
      setIsLoading(false)
    }
  }

  function resetFormState() {
    setEditingId(null)
    setForm(initialForm)
    setBusinessLogoFile(null)
    setLastVatRegRate('')
    if (businessLogoInputRef.current) {
      businessLogoInputRef.current.value = ''
    }
  }

  function handleAddNew() {
    resetFormState()
    setSuccess('')
    setError('')
    setIsFormOpen(true)
  }

  function handleEdit(row: BranchRow) {
    setSelectedRowId(row.branch_id)
    setEditingId(row.branch_id)
    setForm({
      branch_code: row.branch_code,
      branch_name: row.branch_name,
      address: row.address || '',
      is_active: row.is_active,
      ...mapBusinessProfileFromRow(row),
    })
    setBusinessLogoFile(null)
    if (row.busi_vat_type === 'VAT REG TIN') {
      setLastVatRegRate(row.vat_rate)
    }
    setSuccess('')
    setError('')
    setIsFormOpen(true)
  }

  function handleCancelForm() {
    resetFormState()
    setIsFormOpen(false)
  }

  function handleOpenDeleteModal(row: BranchRow) {
    setDeleteTarget(row)
    setDeletePasswords(initialDeletePasswords)
    setError('')
    setSuccess('')
  }

  function handleCloseDeleteModal() {
    if (isDeleting) {
      return
    }

    setDeleteTarget(null)
    setDeletePasswords(initialDeletePasswords)
  }

  function handleDeletePasswordChange(index: number, value: string) {
    setDeletePasswords((current) => current.map((entry, entryIndex) => (entryIndex === index ? value : entry)))
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!deleteTarget) {
      return
    }

    if (deletePasswords.some((password) => !password.trim())) {
      setError('Enter your password in all three confirmation fields to delete this branch.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsDeleting(true)
      await apiFetch<{ message: string }>(`/api/branches/${deleteTarget.branch_id}`, {
        method: 'DELETE',
        body: JSON.stringify({ passwords: deletePasswords.map((password) => password.trim()) }),
        audit: {
          page: AUDIT_PAGES.BRANCHES,
          action: 'DELETE',
          description: buildAuditDescription(
            AUDIT_PAGES.BRANCHES,
            `Deleted branch "${deleteTarget.branch_name}" (${deleteTarget.branch_code}).`,
          ),
          tableName: 'branches',
        },
      })

      setSuccess(`Branch "${deleteTarget.branch_name}" deleted successfully.`)
      setDeleteTarget(null)
      setDeletePasswords(initialDeletePasswords)
      if (editingId === deleteTarget.branch_id) {
        resetFormState()
        setIsFormOpen(false)
      }
      await loadRows()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete branch.')
    } finally {
      setIsDeleting(false)
    }
  }

  function handleBusinessLogoSelected(file: File | null) {
    if (!file) {
      setBusinessLogoFile(null)
      return
    }

    const validationError = validateLogoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setBusinessLogoFile(file)
  }

  function handleBusinessLogoChange(event: ChangeEvent<HTMLInputElement>) {
    handleBusinessLogoSelected(event.target.files?.[0] || null)
  }

  function handleVatTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const { value } = event.target

    if (value === 'VAT-EXEMPT TIN') {
      setLastVatRegRate(form.vat_rate)
    }

    setForm((current) => applyVatTypeChange(current, value, lastVatRegRate))
  }

  function buildBranchFormData() {
    const payload = new FormData()
    const busiName = form.busi_name.trim() || form.branch_name.trim()
    payload.append('branch_name', form.branch_name.trim())
    payload.append('address', form.address.trim())
    payload.append('is_active', form.is_active ? '1' : '0')

    if (editingId) {
      payload.append('branch_code', form.branch_code.trim())
    }

    appendBusinessProfileToFormData(payload, { ...form, busi_name: busiName })

    if (businessLogoFile) {
      payload.append('business_logo', businessLogoFile)
    }

    return payload
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.branch_name.trim()) {
      setError('Branch name is required.')
      return
    }

    const busiName = form.busi_name.trim() || form.branch_name.trim()
    if (!busiName) {
      setError('Business name is required.')
      return
    }

    if (editingId && !form.branch_code.trim()) {
      setError('Branch code is required.')
      return
    }

    try {
      setIsSaving(true)
      const payload = buildBranchFormData()
      const branchLabel = form.busi_name.trim() || form.branch_name.trim()

      if (editingId) {
        await apiFetch<{ data: BranchRow; message?: string }>(`/api/branches/${editingId}`, {
          method: 'PATCH',
          body: payload,
          audit: {
            page: AUDIT_PAGES.BRANCHES,
            action: 'UPDATE',
            description: buildAuditDescription('Branches', `Updated branch "${branchLabel}".`),
            tableName: 'branches',
          },
        })
        setSuccess('Branch updated successfully.')
      } else {
        await apiFetch<{ data: BranchRow; message?: string }>('/api/branches', {
          method: 'POST',
          body: payload,
          audit: {
            page: AUDIT_PAGES.BRANCHES,
            action: 'INSERT',
            description: buildAuditDescription('Branches', `Created branch "${branchLabel}".`),
            tableName: 'branches',
          },
        })
        setSuccess('Branch created successfully.')
      }

      resetFormState()
      setIsFormOpen(false)
      await loadRows()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save branch.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminShell title="Branches" description="Manage store branches for multi-location POS." hideTopbar>
      <section className="settings-stack">
        {error ? <div className="error-state">{error}</div> : null}
        {success ? <div className="success-state">{success}</div> : null}

        <article className="surface-card surface-card--wide">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Branches</p>
              <h1 className="audit-card-title">Branches</h1>
              <p className="audit-card-description">
                Create and manage branch locations. Each branch has its own business profile, products, stock, and sales.
              </p>
            </div>
            <div className="audit-card-actions">
              <button className="topbar-button topbar-button--ghost" type="button" onClick={() => void loadRows()}>
                <ButtonLabel icon="reload">Reload</ButtonLabel>
              </button>
              <button className="topbar-button" type="button" onClick={handleAddNew}>
                <ButtonLabel icon="plus">Add Branch</ButtonLabel>
              </button>
            </div>
          </div>

          {isLoading ? <div className="empty-state">Loading branches...</div> : null}
          {!isLoading && rows.length === 0 ? <div className="empty-state">No branches found.</div> : null}

          {!isLoading && rows.length > 0 ? (
            <div className="branch-card-grid">
              {rows.map((row) => {
                const isSelected = selectedRowId === row.branch_id
                const logoSrc = resolveAssetUrl(row.business_logo_path)

                return (
                  <article
                    key={row.branch_id}
                    className={`branch-card${isSelected ? ' branch-card--selected' : ''}`}
                    onClick={() => setSelectedRowId(row.branch_id)}
                  >
                    <div className="branch-card__header">
                      <div className="branch-card__title-group">
                        {logoSrc ? (
                          <img src={logoSrc} alt="" className="branch-card__logo" aria-hidden="true" />
                        ) : null}
                        <div>
                          <h3 className="branch-card__title">{row.branch_name}</h3>
                          <span className="code-chip">{row.branch_code}</span>
                          <p className="branch-card__status">{row.is_active ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>
                      <span className="branch-card__id">#{row.branch_id}</span>
                    </div>

                    <dl className="branch-card__details">
                      <div className="branch-card__details-row">
                        <div className="branch-card__detail">
                          <dt>Business name</dt>
                          <dd>{row.busi_name || '-'}</dd>
                        </div>
                        <div className="branch-card__detail">
                          <dt>Status</dt>
                          <dd>{row.is_active ? 'Active' : 'Inactive'}</dd>
                        </div>
                      </div>
                      <div className="branch-card__details-row">
                        <div className="branch-card__detail">
                          <dt>Owner</dt>
                          <dd>{row.busi_owner || '-'}</dd>
                        </div>
                        <div className="branch-card__detail">
                          <dt>TIN</dt>
                          <dd>{row.busi_tin || '-'}</dd>
                        </div>
                      </div>
                      <div className="branch-card__details-row">
                        <div className="branch-card__detail">
                          <dt>VAT type</dt>
                          <dd>{row.busi_vat_type || '-'}</dd>
                        </div>
                        <div className="branch-card__detail">
                          <dt>VAT rate</dt>
                          <dd>{row.vat_rate || '-'}</dd>
                        </div>
                      </div>
                      <div className="branch-card__detail branch-card__detail--full">
                        <dt>Branch address</dt>
                        <dd>{row.address || '-'}</dd>
                      </div>
                      <div className="branch-card__detail branch-card__detail--full">
                        <dt>Business address</dt>
                        <dd>{row.busi_addr || '-'}</dd>
                      </div>
                    </dl>

                    <div className="branch-card__actions">
                      <button
                        className="terminal-action"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleEdit(row)
                        }}
                      >
                        <ButtonLabel icon="edit">Edit</ButtonLabel>
                      </button>
                      <button
                        type="button"
                        className="terminal-action stock-batch-delete-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleOpenDeleteModal(row)
                        }}
                        aria-label={`Delete branch ${row.branch_name}`}
                        title="Delete branch"
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
                  </article>
                )
              })}
            </div>
          ) : null}
        </article>
      </section>

      {isFormOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div
            className="terminal-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>{editingId ? 'Edit Branch' : 'Add Branch'}</h2>
                  <p>Set branch identity and business profile used on receipts and POS.</p>
                </div>
              </div>

              <form className="settings-stack branch-form-modal" onSubmit={handleSubmit}>
                <div className="settings-grid branch-form-grid">
                  <article className="panel settings-panel">
                    <div className="branch-form-section-title">
                      <h3>Branch details</h3>
                      <p className="field-hint">Operational identity for this location.</p>
                    </div>

                    <div className="settings-form-grid settings-form-grid--single-column">
                      <div className="field receipt-logo-field">
                        <label htmlFor="business_logo">Business logo</label>
                        <div className="receipt-logo-row">
                          <div className="receipt-logo-preview-wrap">
                            {businessLogoPreview || form.business_logo_path ? (
                              <img
                                src={businessLogoPreview || resolveAssetUrl(form.business_logo_path) || ''}
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
                              accept={allowedLogoAccept}
                              onChange={handleBusinessLogoChange}
                              disabled={isSaving}
                            />
                            <div
                              className={`receipt-logo-dropzone${isBusinessLogoDragOver ? ' is-drag-over' : ''}`}
                              role="button"
                              tabIndex={0}
                              aria-label="Drag and drop business logo or press Enter to browse"
                              onClick={() => businessLogoInputRef.current?.click()}
                              onKeyDown={(event) => handleLogoDropzoneKeyDown(event, businessLogoInputRef)}
                              onDrop={(event) =>
                                handleLogoDrop(event, setIsBusinessLogoDragOver, handleBusinessLogoSelected)
                              }
                              onDragOver={(event) => handleLogoDragOver(event, setIsBusinessLogoDragOver)}
                              onDragLeave={() => handleLogoDragLeave(setIsBusinessLogoDragOver)}
                            >
                              <strong>Drag and drop logo here</strong>
                              <span>or click to browse</span>
                              <small>{getLogoDropzoneStatus(false, businessLogoFile, form.business_logo_path)}</small>
                            </div>
                            <p className="field-hint">Accepted: {allowedLogoHint}</p>
                          </div>
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="branch_code">Branch code</label>
                        {editingId ? (
                          <input
                            id="branch_code"
                            name="branch_code"
                            value={form.branch_code}
                            onChange={(event) => setForm((current) => ({ ...current, branch_code: event.target.value }))}
                            disabled
                          />
                        ) : (
                          <>
                            <input id="branch_code" name="branch_code" value="Auto-generated" readOnly disabled />
                            <p className="field-hint">
                              A unique code (for example BR001) is assigned automatically when you save.
                            </p>
                          </>
                        )}
                      </div>
                      <div className="field">
                        <label htmlFor="branch_name">Branch name</label>
                        <input
                          id="branch_name"
                          name="branch_name"
                          value={form.branch_name}
                          onChange={(event) => setForm((current) => ({ ...current, branch_name: event.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="address">Branch address</label>
                        <input
                          id="address"
                          name="address"
                          value={form.address}
                          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                        />
                      </div>
                      <div className="field user-toggle-row">
                        <label htmlFor="is_active">Active</label>
                        <label className="user-toggle-switch" aria-label="Toggle branch active status">
                          <input
                            id="is_active"
                            name="is_active"
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                          />
                          <span className="user-toggle-slider" aria-hidden="true" />
                        </label>
                      </div>
                    </div>
                  </article>

                  <article className="panel settings-panel">
                    <div className="branch-form-section-title">
                      <h3>Business profile</h3>
                      <p className="field-hint">Used on receipts, login screens, and VAT calculations for this branch.</p>
                    </div>

                    <div className="settings-form-grid settings-form-grid--single-column">
                      <div className="field">
                        <label htmlFor="busi_name">Business name</label>
                        <input
                          id="busi_name"
                          name="busi_name"
                          value={form.busi_name}
                          onChange={(event) =>
                            setForm((current) => handleBusinessFieldChange(current, event, setLastVatRegRate))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="busi_addr">Business address</label>
                        <input
                          id="busi_addr"
                          name="busi_addr"
                          value={form.busi_addr}
                          onChange={(event) => setForm((current) => handleBusinessFieldChange(current, event))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="busi_owner">Business owner</label>
                        <input
                          id="busi_owner"
                          name="busi_owner"
                          value={form.busi_owner}
                          onChange={(event) => setForm((current) => handleBusinessFieldChange(current, event))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="busi_tin">TIN</label>
                        <input
                          id="busi_tin"
                          name="busi_tin"
                          value={form.busi_tin}
                          onChange={(event) => setForm((current) => handleBusinessFieldChange(current, event))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="busi_vat_type">VAT type</label>
                        <select
                          id="busi_vat_type"
                          name="busi_vat_type"
                          value={form.busi_vat_type}
                          onChange={handleVatTypeChange}
                        >
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
                          onChange={(event) =>
                            setForm((current) => handleBusinessFieldChange(current, event, setLastVatRegRate))
                          }
                          disabled={form.busi_vat_type === 'VAT-EXEMPT TIN'}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="price_vat_mode">Price VAT mode</label>
                        <select
                          id="price_vat_mode"
                          name="price_vat_mode"
                          value={form.price_vat_mode}
                          onChange={(event) => setForm((current) => handleBusinessFieldChange(current, event))}
                          disabled={form.busi_vat_type === 'VAT-EXEMPT TIN'}
                        >
                          {priceVatModeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </article>
                </div>

                <div className="form-actions">
                  <ThemedButton type="button" variant="secondary" onClick={handleCancelForm} disabled={isSaving}>
                    Cancel
                  </ThemedButton>
                  <ThemedButton type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : editingId ? 'Update Branch' : 'Create Branch'}
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card terminal-delete-modal">
              <div className="panel-header">
                <div>
                  <h2>Delete Branch</h2>
                  <p>
                    Enter your password three times to permanently delete{' '}
                    <strong>{deleteTarget.branch_name}</strong> ({deleteTarget.branch_code}) and all related branch data.
                  </p>
                </div>
              </div>

              <form
                className="settings-stack"
                onSubmit={(event) => {
                  void handleDelete(event)
                }}
              >
                {deletePasswords.map((password, index) => (
                  <div className="field" key={`branch-delete-password-${index + 1}`}>
                    <label htmlFor={`branch_delete_password_${index + 1}`}>Password confirmation {index + 1} of 3</label>
                    <input
                      id={`branch_delete_password_${index + 1}`}
                      name={`branch_delete_password_${index + 1}`}
                      type="password"
                      value={password}
                      onChange={(event) => handleDeletePasswordChange(index, event.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                ))}

                <div className="settings-actions">
                  <ThemedButton type="button" variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isDeleting}>
                    <ButtonLabel icon="delete">{isDeleting ? 'Deleting...' : 'Confirm delete'}</ButtonLabel>
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}

export default BranchesPage
