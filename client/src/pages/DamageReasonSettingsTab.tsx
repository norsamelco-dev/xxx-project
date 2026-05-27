import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ThemedButton } from '../components/ThemedButton'
import { ButtonLabel } from '../components/ButtonIcon'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'

type DamageReasonOption = {
  id: number
  reason_code: string
  reason_label: string
  sort_order: number
  is_active: number
}

type ReasonOptionsResponse = {
  data: DamageReasonOption[]
}

type ReasonOptionForm = {
  reason_code: string
  reason_label: string
}

const emptyForm: ReasonOptionForm = {
  reason_code: '',
  reason_label: '',
}

const auditPage = AUDIT_PAGES.DAMAGE_REASON_SETTINGS
const auditTable = 'damage_reason_options'

function slugifyReasonCode(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

function DamageReasonSettingsTab() {
  const [options, setOptions] = useState<DamageReasonOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DamageReasonOption | null>(null)
  const [editingOption, setEditingOption] = useState<DamageReasonOption | null>(null)
  const [addForm, setAddForm] = useState<ReasonOptionForm>(emptyForm)
  const [editLabel, setEditLabel] = useState('')

  const sortedOptions = useMemo(
    () => [...options].sort((left, right) => left.sort_order - right.sort_order || left.reason_label.localeCompare(right.reason_label)),
    [options],
  )

  useEffect(() => {
    void loadOptions()
  }, [])

  async function loadOptions() {
    try {
      setIsLoading(true)
      setError('')

      const response = await apiFetch<ReasonOptionsResponse>('/api/damage-reports/reason-options')
      setOptions(response.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load damage reason options.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleOpenAddModal() {
    setAddForm(emptyForm)
    setIsAddModalOpen(true)
    setError('')
    setSuccess('')
  }

  function handleCloseAddModal() {
    if (isSaving) {
      return
    }

    setIsAddModalOpen(false)
    setAddForm(emptyForm)
  }

  function handleOpenEditModal(option: DamageReasonOption) {
    setEditingOption(option)
    setEditLabel(option.reason_label)
    setIsEditModalOpen(true)
    setError('')
    setSuccess('')
  }

  function handleCloseEditModal() {
    if (isSaving) {
      return
    }

    setIsEditModalOpen(false)
    setEditingOption(null)
    setEditLabel('')
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const reasonCode = addForm.reason_code.trim() || slugifyReasonCode(addForm.reason_label)
    const reasonLabel = addForm.reason_label.trim()

    if (!reasonCode) {
      setError('Reason code is required.')
      return
    }

    if (!/^[a-z0-9_]+$/.test(reasonCode)) {
      setError('Reason code must use lowercase letters, numbers, and underscores only.')
      return
    }

    if (!reasonLabel) {
      setError('Reason label is required.')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      setSuccess('')

      const response = await apiFetch<{ data: DamageReasonOption; message: string }>('/api/damage-reports/reason-options', {
        method: 'POST',
        body: JSON.stringify({
          reason_code: reasonCode,
          reason_label: reasonLabel,
        }),
        audit: {
          page: auditPage,
          action: 'INSERT',
          description: buildAuditDescription(auditPage, `Created damage reason option "${reasonLabel}" (${reasonCode}).`),
          tableName: auditTable,
        },
      })

      setOptions((current) => [...current, response.data])
      setSuccess(response.message || 'Damage reason option created.')
      handleCloseAddModal()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create damage reason option.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingOption) {
      return
    }

    const reasonLabel = editLabel.trim()

    if (!reasonLabel) {
      setError('Reason label is required.')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      setSuccess('')

      const response = await apiFetch<{ data: DamageReasonOption; message: string }>(
        `/api/damage-reports/reason-options/${editingOption.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ reason_label: reasonLabel }),
          audit: {
            page: auditPage,
            action: 'UPDATE',
            description: buildAuditDescription(
              auditPage,
              `Updated damage reason option "${editingOption.reason_code}" label to "${reasonLabel}".`,
            ),
            tableName: auditTable,
          },
        },
      )

      setOptions((current) => current.map((option) => (option.id === response.data.id ? response.data : option)))
      setSuccess(response.message || 'Damage reason option updated.')
      handleCloseEditModal()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update damage reason option.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActive(option: DamageReasonOption) {
    const nextActive = option.is_active ? 0 : 1

    try {
      setError('')
      setSuccess('')

      const response = await apiFetch<{ data: DamageReasonOption; message: string }>(
        `/api/damage-reports/reason-options/${option.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ is_active: nextActive }),
          audit: {
            page: auditPage,
            action: 'UPDATE',
            description: buildAuditDescription(
              auditPage,
              `${nextActive ? 'Enabled' : 'Disabled'} damage reason option "${option.reason_label}" (${option.reason_code}).`,
            ),
            tableName: auditTable,
          },
        },
      )

      setOptions((current) => current.map((row) => (row.id === response.data.id ? response.data : row)))
      setSuccess(response.message || `Damage reason option ${nextActive ? 'enabled' : 'disabled'}.`)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update damage reason option status.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return
    }

    try {
      setIsDeleting(true)
      setError('')
      setSuccess('')

      await apiFetch<{ message: string }>(`/api/damage-reports/reason-options/${deleteTarget.id}`, {
        method: 'DELETE',
        audit: {
          page: auditPage,
          action: 'DELETE',
          description: buildAuditDescription(
            auditPage,
            `Deleted damage reason option "${deleteTarget.reason_label}" (${deleteTarget.reason_code}).`,
          ),
          tableName: auditTable,
        },
      })

      setOptions((current) => current.filter((option) => option.id !== deleteTarget.id))
      setSuccess('Damage reason option deleted.')
      setDeleteTarget(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete damage reason option.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleMove(optionId: number, direction: 'up' | 'down') {
    const index = sortedOptions.findIndex((option) => option.id === optionId)

    if (index < 0) {
      return
    }

    const swapIndex = direction === 'up' ? index - 1 : index + 1

    if (swapIndex < 0 || swapIndex >= sortedOptions.length) {
      return
    }

    const nextOrder = [...sortedOptions]
    const temp = nextOrder[index]
    nextOrder[index] = nextOrder[swapIndex]
    nextOrder[swapIndex] = temp

    try {
      setIsReordering(true)
      setError('')
      setSuccess('')

      const response = await apiFetch<{ data: DamageReasonOption[]; message: string }>(
        '/api/damage-reports/reason-options/reorder',
        {
          method: 'PUT',
          body: JSON.stringify({ ordered_ids: nextOrder.map((option) => option.id) }),
          audit: {
            page: auditPage,
            action: 'UPDATE',
            description: buildAuditDescription(auditPage, 'Reordered damage reason options.'),
            tableName: auditTable,
          },
        },
      )

      setOptions(response.data || [])
      setSuccess(response.message || 'Damage reason options reordered.')
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : 'Unable to reorder damage reason options.')
    } finally {
      setIsReordering(false)
    }
  }

  return (
    <>
      <div className="damage-reason-settings-toolbar">
        <ThemedButton type="button" variant="primary" onClick={handleOpenAddModal}>
          <ButtonLabel icon="plus">Add Reason</ButtonLabel>
        </ThemedButton>
      </div>

      {error ? <p className="form-message form-message--error">{error}</p> : null}
      {success ? <p className="form-message form-message--success">{success}</p> : null}

      {isLoading ? <div className="empty-state">Loading damage reason options...</div> : null}

      {!isLoading && sortedOptions.length === 0 ? (
        <div className="empty-state">No damage reason options found. Add a reason to get started.</div>
      ) : null}

      {!isLoading && sortedOptions.length > 0 ? (
        <div className="table-wrap damage-reason-settings-table-wrap">
          <table className="data-table damage-reason-settings-table">
            <thead>
              <tr>
                <th>Sort</th>
                <th>Code</th>
                <th>Label</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedOptions.map((option, index) => (
                <tr key={option.id}>
                  <td>{option.sort_order}</td>
                  <td>
                    <code className="damage-reason-code">{option.reason_code}</code>
                  </td>
                  <td>{option.reason_label}</td>
                  <td>
                    <span className={`status-pill status-pill--${option.is_active ? 'success' : 'pending'}`}>
                      {option.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions damage-reason-settings-actions">
                      <button
                        type="button"
                        className="button-secondary button-secondary--compact"
                        onClick={() => handleOpenEditModal(option)}
                      >
                        <ButtonLabel icon="edit">Edit</ButtonLabel>
                      </button>
                      <button
                        type="button"
                        className="button-secondary button-secondary--compact"
                        onClick={() => void handleToggleActive(option)}
                      >
                        <ButtonLabel icon={option.is_active ? 'hide' : 'check'}>
                          {option.is_active ? 'Disable' : 'Enable'}
                        </ButtonLabel>
                      </button>
                      <button
                        type="button"
                        className="button-secondary button-secondary--compact"
                        onClick={() => void handleMove(option.id, 'up')}
                        disabled={isReordering || index === 0}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="button-secondary button-secondary--compact"
                        onClick={() => void handleMove(option.id, 'down')}
                        disabled={isReordering || index === sortedOptions.length - 1}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="button-secondary button-secondary--compact"
                        onClick={() => setDeleteTarget(option)}
                      >
                        <ButtonLabel icon="delete">Delete</ButtonLabel>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {isAddModalOpen ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card">
              <div className="panel-header">
                <div>
                  <h2>Add Damage Reason</h2>
                  <p>Create a new dropdown option for damage reports.</p>
                </div>
              </div>

              <form className="settings-stack" onSubmit={(event) => void handleCreate(event)}>
                <label className="field">
                  <span>Reason label</span>
                  <input
                    type="text"
                    value={addForm.reason_label}
                    onChange={(event) => {
                      const nextLabel = event.target.value
                      setAddForm((current) => ({
                        reason_label: nextLabel,
                        reason_code: current.reason_code || slugifyReasonCode(nextLabel),
                      }))
                    }}
                    maxLength={100}
                    required
                  />
                </label>
                <label className="field">
                  <span>Reason code</span>
                  <input
                    type="text"
                    value={addForm.reason_code}
                    onChange={(event) => setAddForm((current) => ({ ...current, reason_code: event.target.value }))}
                    maxLength={50}
                    pattern="[a-z0-9_]+"
                    required
                  />
                </label>
                <p className="field-hint">Use lowercase letters, numbers, and underscores only. Reason code cannot be changed later.</p>

                <div className="terminal-modal-actions">
                  <ThemedButton type="button" variant="secondary" onClick={handleCloseAddModal} disabled={isSaving}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isSaving}>
                    <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Add Reason'}</ButtonLabel>
                  </ThemedButton>
                </div>
              </form>
            </article>
          </div>
        </div>
      ) : null}

      {isEditModalOpen && editingOption ? (
        <div className="terminal-modal-backdrop" role="presentation">
          <div className="terminal-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card">
              <div className="panel-header">
                <div>
                  <h2>Edit Damage Reason</h2>
                  <p>
                    Code <code className="damage-reason-code">{editingOption.reason_code}</code> cannot be changed.
                  </p>
                </div>
              </div>

              <form className="settings-stack" onSubmit={(event) => void handleUpdateLabel(event)}>
                <label className="field">
                  <span>Reason label</span>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(event) => setEditLabel(event.target.value)}
                    maxLength={100}
                    required
                  />
                </label>

                <div className="terminal-modal-actions">
                  <ThemedButton type="button" variant="secondary" onClick={handleCloseEditModal} disabled={isSaving}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isSaving}>
                    <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Save Changes'}</ButtonLabel>
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
                  <h2>Delete Damage Reason</h2>
                  <p>
                    Permanently delete <strong>{deleteTarget.reason_label}</strong> ({deleteTarget.reason_code})? Existing
                    report items keep their stored label text.
                  </p>
                </div>
              </div>

              <div className="terminal-modal-actions">
                <ThemedButton type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                  <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                </ThemedButton>
                <ThemedButton type="button" variant="primary" onClick={() => void handleDelete()} disabled={isDeleting}>
                  <ButtonLabel icon="delete">{isDeleting ? 'Deleting...' : 'Confirm Delete'}</ButtonLabel>
                </ThemedButton>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default DamageReasonSettingsTab
