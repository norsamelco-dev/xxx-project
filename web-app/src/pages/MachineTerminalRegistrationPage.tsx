import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ThemedDataGrid } from '../components/ThemedDataGrid'
import { ThemedButton } from '../components/ThemedButton'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'

type MachineTerminal = {
  ID: number
  machine_name: string
  serial_number: string
  min_number: string
  ptu_number: string
  or_start: number | null
  or_end: number | null
  current_or: number | null
  valid_start: string | null
  valid_end: string | null
  is_active: number
}

type MachineTerminalForm = {
  machine_name: string
  serial_number: string
  min_number: string
  ptu_number: string
  or_start: string
  or_end: string
  current_or: string
  valid_start: string
  valid_end: string
  is_active: boolean
}

type DuplicateField = {
  field: keyof Pick<MachineTerminalForm, 'machine_name' | 'serial_number' | 'min_number' | 'ptu_number' | 'or_start' | 'or_end'>
  label: string
  value: string | number
  matchId?: number
}

type ValidationResponse = {
  duplicates: DuplicateField[]
  hasDuplicates: boolean
}

const initialForm: MachineTerminalForm = {
  machine_name: '',
  serial_number: '',
  min_number: '',
  ptu_number: '',
  or_start: '',
  or_end: '',
  current_or: '',
  valid_start: '',
  valid_end: '',
  is_active: true,
}

function toInputDate(value: string | null) {
  if (!value) {
    return ''
  }

  return String(value).slice(0, 10)
}

function toFormValue(value: number | null) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function mapRowToForm(row: MachineTerminal): MachineTerminalForm {
  return {
    machine_name: row.machine_name || '',
    serial_number: row.serial_number || '',
    min_number: row.min_number || '',
    ptu_number: row.ptu_number || '',
    or_start: toFormValue(row.or_start),
    or_end: toFormValue(row.or_end),
    current_or: toFormValue(row.current_or),
    valid_start: toInputDate(row.valid_start),
    valid_end: toInputDate(row.valid_end),
    is_active: Boolean(row.is_active),
  }
}

function formatOrValue(value: number | null) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).padStart(8, '0')
}

const duplicateFieldLabels: Record<DuplicateField['field'], string> = {
  machine_name: 'MachineName',
  serial_number: 'SerialNumber',
  min_number: 'MachineIdentificationNumber',
  ptu_number: 'PermitToUseNumber',
  or_start: 'OR_Start',
  or_end: 'OR_End',
}

function buildDuplicateErrorMap(duplicates: DuplicateField[]) {
  return duplicates.reduce<Record<string, string>>((accumulator, duplicate) => {
    const rowHint = duplicate.matchId ? ` (row #${duplicate.matchId})` : ''
    accumulator[duplicate.field] = `${duplicate.label || duplicateFieldLabels[duplicate.field]} already exists${rowHint}.`
    return accumulator
  }, {})
}

function MachineTerminalRegistrationPage() {
  usePageVisitAudit(AUDIT_PAGES.MACHINE_TERMINAL)
  const [rows, setRows] = useState<MachineTerminal[]>([])
  const [form, setForm] = useState<MachineTerminalForm>(initialForm)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MachineTerminal | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [duplicateErrors, setDuplicateErrors] = useState<Record<string, string>>({})
  const [duplicateRowIds, setDuplicateRowIds] = useState<number[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void loadRows()
  }, [])

  useEffect(() => {
    if (!isFormOpen) {
      setDuplicateErrors({})
      setDuplicateRowIds([])
      setIsValidating(false)
      return
    }

    const valuesToCheck = {
      machine_name: form.machine_name.trim(),
      serial_number: form.serial_number.trim(),
      min_number: form.min_number.trim(),
      ptu_number: form.ptu_number.trim(),
      or_start: form.or_start.trim(),
      or_end: form.or_end.trim(),
    }

    const shouldValidate = Object.values(valuesToCheck).some((value) => value !== '')

    if (!shouldValidate) {
      setDuplicateErrors({})
      setDuplicateRowIds([])
      setIsValidating(false)
      return
    }

    let cancelled = false

    async function validateDuplicates() {
      try {
        setIsValidating(true)
        const response = await apiFetch<ValidationResponse>('/api/machine-terminal-registration/validate', {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            id: editingId,
          }),
        })

        if (!cancelled) {
          const duplicates = response.duplicates || []
          setDuplicateErrors(buildDuplicateErrorMap(duplicates))
          setDuplicateRowIds(
            Array.from(new Set(duplicates.map((duplicate) => duplicate.matchId).filter((id): id is number => Boolean(id)))),
          )
        }
      } catch (validationError) {
        if (!cancelled) {
          setDuplicateErrors({})
          setDuplicateRowIds([])
        }
      } finally {
        if (!cancelled) {
          setIsValidating(false)
        }
      }
    }

    const timeout = window.setTimeout(() => {
      void validateDuplicates()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [editingId, form, isFormOpen])

  async function loadRows() {
    try {
      setError('')
      setIsLoading(true)
      const response = await apiFetch<{ data: MachineTerminal[] }>('/api/machine-terminal-registration')
      setRows(response.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load machine terminal records.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleAddNew() {
    setSelectedRowId(null)
    setEditingId(null)
    setForm(initialForm)
    setSuccess('')
    setError('')
    setDuplicateErrors({})
    setDuplicateRowIds([])
    setIsFormOpen(true)
  }

  function handleEdit(row: MachineTerminal) {
    setSelectedRowId(row.ID)
    setEditingId(row.ID)
    setForm(mapRowToForm(row))
    setSuccess('')
    setError('')
    setDuplicateErrors({})
    setDuplicateRowIds([])
    setIsFormOpen(true)
  }

  function handleCancelForm() {
    setEditingId(null)
    setForm(initialForm)
    setDuplicateErrors({})
    setDuplicateRowIds([])
    setIsFormOpen(false)
  }

  const currentEditingRow = editingId ? rows.find((row) => row.ID === editingId) || null : null

  function handleOpenDeleteModal(row: MachineTerminal | null) {
    if (!row) {
      return
    }

    setSelectedRowId(row.ID)
    setDeleteTarget(row)
    setDeletePassword('')
    setError('')
    setSuccess('')
  }

  function handleCloseDeleteModal() {
    if (isDeleting) {
      return
    }

    setDeleteTarget(null)
    setDeletePassword('')
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function hasDuplicateErrors() {
    return Object.keys(duplicateErrors).length > 0
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!deleteTarget) {
      return
    }

    if (!deletePassword) {
      setError('Enter your password to confirm delete.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsDeleting(true)
      await apiFetch<{ message: string }>(`/api/machine-terminal-registration/${deleteTarget.ID}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
        audit: {
          page: AUDIT_PAGES.MACHINE_TERMINAL,
          action: 'DELETE',
          description: buildAuditDescription(
            AUDIT_PAGES.MACHINE_TERMINAL,
            `Deleted machine terminal "${deleteTarget.machine_name}" (MIN ${deleteTarget.min_number}).`,
          ),
          tableName: 'machine_terminal_registration',
        },
      })

      setSuccess('Machine terminal deleted successfully.')
      setDeleteTarget(null)
      setDeletePassword('')
      setDuplicateRowIds([])
      await loadRows()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete machine terminal record.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (hasDuplicateErrors()) {
      setError('Resolve duplicate values before saving the terminal.')
      return
    }

    if (!form.machine_name.trim()) {
      setError('Machine name is required.')
      return
    }

    if (!form.serial_number.trim()) {
      setError('Serial number is required.')
      return
    }

    if (!form.min_number.trim()) {
      setError('Machine Identification Number is required.')
      return
    }

    if (!form.ptu_number.trim()) {
      setError('Permit To Use number is required.')
      return
    }

    try {
      setIsSaving(true)

      const payload = {
        machine_name: form.machine_name,
        serial_number: form.serial_number,
        min_number: form.min_number,
        ptu_number: form.ptu_number,
        or_start: form.or_start.trim() === '' ? null : Number(form.or_start),
        or_end: form.or_end.trim() === '' ? null : Number(form.or_end),
        current_or: form.current_or.trim() === '' ? null : Number(form.current_or),
        valid_start: form.valid_start || null,
        valid_end: form.valid_end || null,
        is_active: form.is_active,
      }

      const endpoint = editingId
        ? `/api/machine-terminal-registration/${editingId}`
        : '/api/machine-terminal-registration'
      const method = editingId ? 'PUT' : 'POST'

      const response = await apiFetch<{ message: string }>(endpoint, {
        method,
        body: JSON.stringify(payload),
        audit: {
          page: AUDIT_PAGES.MACHINE_TERMINAL,
          action: editingId ? 'UPDATE' : 'INSERT',
          description: buildAuditDescription(
            AUDIT_PAGES.MACHINE_TERMINAL,
            editingId
              ? `Updated machine terminal "${form.machine_name.trim()}" (MIN ${form.min_number.trim()}).`
              : `Registered machine terminal "${form.machine_name.trim()}" (MIN ${form.min_number.trim()}).`,
          ),
          tableName: 'machine_terminal_registration',
        },
      })

      setSuccess(response.message || 'Machine terminal saved successfully.')
      setEditingId(null)
      setForm(initialForm)
      setDuplicateErrors({})
      setDuplicateRowIds([])
      setIsFormOpen(false)
      await loadRows()
    } catch (saveError) {
      const nextError = saveError as Error & { duplicates?: DuplicateField[]; status?: number }

      if (nextError.status === 409 && nextError.duplicates) {
        setDuplicateErrors(buildDuplicateErrorMap(nextError.duplicates))
        setDuplicateRowIds(
          Array.from(
            new Set(nextError.duplicates.map((duplicate) => duplicate.matchId).filter((id): id is number => Boolean(id))),
          ),
        )
      }

      setError(saveError instanceof Error ? saveError.message : 'Unable to save machine terminal record.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminShell
      title="Machine / Terminal Registration"
      description="Manage POS terminals registered under approved BIR Permit to Use entries."
      hideTopbar
    >
      <section className="settings-stack">
        {error ? <div className="error-state">{error}</div> : null}
        {success ? <div className="success-state">{success}</div> : null}

        <article className="surface-card surface-card--wide">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Machine / Terminal Registration</p>
              <h1 className="audit-card-title">Machine / Terminal Registration</h1>
              <p className="audit-card-description">Manage POS terminals registered under approved BIR Permit to Use entries.</p>
            </div>

            <div className="audit-card-actions">
              <button className="topbar-button" type="button" onClick={handleAddNew}>
                <ButtonLabel icon="plus">+ Add Terminal</ButtonLabel>
              </button>
            </div>
          </div>

          <div className="panel-header">
            <div>
              <h2>Select a row to modify or delete details.</h2>
            </div>
          </div>

          {isLoading ? <div className="empty-state">Loading machine terminal records...</div> : null}

          {!isLoading && rows.length === 0 ? <div className="empty-state">No terminal records found.</div> : null}

          {!isLoading && rows.length > 0 ? (
            <ThemedDataGrid>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>MachineName</th>
                    <th>SerialNumber</th>
                    <th>MachineIdentificationNumber</th>
                    <th>PermitToUseNumber</th>
                    <th>OR_Start</th>
                    <th>OR_End</th>
                    <th>OR_Current</th>
                    <th>StartOfValidity</th>
                    <th>EndOfValidity</th>
                    <th>ACTIVE</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.ID}
                      className={`${row.ID === selectedRowId ? 'terminal-row-selected' : ''} ${duplicateRowIds.includes(row.ID) ? 'terminal-row-duplicate' : ''}`.trim()}
                      onClick={() => setSelectedRowId(row.ID)}
                    >
                      <td>
                        <span className={`terminal-id-pill ${row.is_active ? 'active' : 'inactive'}`}>{row.ID}</span>
                      </td>
                      <td>{row.machine_name || ''}</td>
                      <td>{row.serial_number || ''}</td>
                      <td>{row.min_number || ''}</td>
                      <td>{row.ptu_number || ''}</td>
                      <td>{formatOrValue(row.or_start)}</td>
                      <td>{formatOrValue(row.or_end)}</td>
                      <td>{formatOrValue(row.current_or)}</td>
                      <td>{toInputDate(row.valid_start)}</td>
                      <td>{toInputDate(row.valid_end)}</td>
                      <td>
                        <input type="checkbox" checked={Boolean(row.is_active)} readOnly />
                      </td>
                      <td>
                        <ThemedButton className="terminal-action" variant="secondary" type="button" onClick={() => handleEdit(row)}>
                          <ButtonLabel icon="edit">MODIFY</ButtonLabel>
                        </ThemedButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ThemedDataGrid>
          ) : null}
        </article>

        {isFormOpen ? (
          <div className="terminal-modal-backdrop" role="presentation">
            <article
              className="panel settings-card terminal-modal"
              role="dialog"
              aria-modal="true"
              aria-label={editingId ? 'Modify Terminal' : 'Add Terminal'}
            >
              <div className="panel-header">
                <div>
                  <h2>{editingId ? 'Modify Terminal' : 'Add Terminal'}</h2>
                  <p>Provide the machine details for terminal registration.</p>
                  {isValidating ? <p className="field-hint">Checking for duplicates...</p> : null}
                </div>

                {editingId ? (
                  <button
                    type="button"
                    className="product-delete-trigger"
                    onClick={() => handleOpenDeleteModal(currentEditingRow)}
                    disabled={isDeleting || isSaving || !currentEditingRow}
                  >
                    <ButtonLabel icon="delete">Delete</ButtonLabel>
                  </button>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="settings-stack">
                <div className="terminal-form-grid">
                  <div className="field">
                    <label htmlFor="machine_name">MachineName</label>
                    <input id="machine_name" name="machine_name" value={form.machine_name} onChange={handleChange} />
                    {duplicateErrors.machine_name ? <span className="field-error">{duplicateErrors.machine_name}</span> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="serial_number">SerialNumber</label>
                    <input id="serial_number" name="serial_number" value={form.serial_number} onChange={handleChange} />
                    {duplicateErrors.serial_number ? <span className="field-error">{duplicateErrors.serial_number}</span> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="min_number">MachineIdentificationNumber</label>
                    <input id="min_number" name="min_number" value={form.min_number} onChange={handleChange} />
                    {duplicateErrors.min_number ? <span className="field-error">{duplicateErrors.min_number}</span> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="ptu_number">PermitToUseNumber</label>
                    <input id="ptu_number" name="ptu_number" value={form.ptu_number} onChange={handleChange} />
                    {duplicateErrors.ptu_number ? <span className="field-error">{duplicateErrors.ptu_number}</span> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="or_start">OR_Start</label>
                    <input id="or_start" name="or_start" type="number" value={form.or_start} onChange={handleChange} />
                    {duplicateErrors.or_start ? <span className="field-error">{duplicateErrors.or_start}</span> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="or_end">OR_End</label>
                    <input id="or_end" name="or_end" type="number" value={form.or_end} onChange={handleChange} />
                    {duplicateErrors.or_end ? <span className="field-error">{duplicateErrors.or_end}</span> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="current_or">OR_Current</label>
                    <input id="current_or" name="current_or" type="number" value={form.current_or} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="valid_start">StartOfValidity</label>
                    <input id="valid_start" name="valid_start" type="date" value={form.valid_start} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="valid_end">EndOfValidity</label>
                    <input id="valid_end" name="valid_end" type="date" value={form.valid_end} onChange={handleChange} />
                  </div>
                  <div className="field terminal-checkbox">
                    <label htmlFor="is_active">ACTIVE</label>
                    <input id="is_active" name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} />
                  </div>
                </div>

                <div className="settings-actions">
                  <ThemedButton type="button" variant="secondary" onClick={handleCancelForm} disabled={isSaving}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isSaving || isValidating || hasDuplicateErrors()}>
                    <ButtonLabel icon="save">{isSaving ? 'Saving...' : editingId ? 'Update terminal' : 'Save terminal'}</ButtonLabel>
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        ) : null}

        {deleteTarget ? (
          <div className="terminal-modal-backdrop" role="presentation">
            <article
              className="panel settings-card terminal-modal terminal-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Delete terminal verification"
            >
              <div className="panel-header">
                <div>
                  <h2>Delete Terminal</h2>
                  <p>
                    Enter your password to permanently delete{' '}
                    <strong>{deleteTarget.machine_name || `#${deleteTarget.ID}`}</strong>.
                  </p>
                </div>
              </div>

              <form onSubmit={handleDelete} className="settings-stack">
                <div className="field">
                  <label htmlFor="delete_password">Password verification</label>
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
        ) : null}
      </section>
    </AdminShell>
  )
}

export default MachineTerminalRegistrationPage