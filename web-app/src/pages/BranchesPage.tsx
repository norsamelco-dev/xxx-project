import { useEffect, useState, type FormEvent } from 'react'
import AdminShell from '../components/AdminShell'
import { ThemedButton } from '../components/ThemedButton'
import { ThemedDataGrid } from '../components/ThemedDataGrid'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'

type BranchRow = {
  branch_id: number
  branch_code: string
  branch_name: string
  address: string | null
  is_active: boolean
  created_at: string | null
}

type BranchForm = {
  branch_code: string
  branch_name: string
  address: string
  is_active: boolean
}

const initialForm: BranchForm = {
  branch_code: '',
  branch_name: '',
  address: '',
  is_active: true,
}

const initialDeletePasswords = ['', '', '']

function BranchesPage() {
  usePageVisitAudit('Branches')
  const [rows, setRows] = useState<BranchRow[]>([])
  const [form, setForm] = useState<BranchForm>(initialForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BranchRow | null>(null)
  const [deletePasswords, setDeletePasswords] = useState<string[]>(initialDeletePasswords)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void loadRows()
  }, [])

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

  function handleAddNew() {
    setEditingId(null)
    setForm(initialForm)
    setSuccess('')
    setError('')
    setIsFormOpen(true)
  }

  function handleEdit(row: BranchRow) {
    setEditingId(row.branch_id)
    setForm({
      branch_code: row.branch_code,
      branch_name: row.branch_name,
      address: row.address || '',
      is_active: row.is_active,
    })
    setSuccess('')
    setError('')
    setIsFormOpen(true)
  }

  function handleCancelForm() {
    setEditingId(null)
    setForm(initialForm)
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
        setEditingId(null)
        setForm(initialForm)
        setIsFormOpen(false)
      }
      await loadRows()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete branch.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.branch_name.trim()) {
      setError('Branch name is required.')
      return
    }

    if (editingId && !form.branch_code.trim()) {
      setError('Branch code is required.')
      return
    }

    try {
      setIsSaving(true)
      const payload = editingId
        ? {
            branch_code: form.branch_code.trim(),
            branch_name: form.branch_name.trim(),
            address: form.address.trim(),
            is_active: form.is_active,
          }
        : {
            branch_name: form.branch_name.trim(),
            address: form.address.trim(),
            is_active: form.is_active,
          }

      if (editingId) {
        await apiFetch<{ data: BranchRow; message?: string }>(`/api/branches/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          audit: {
            page: AUDIT_PAGES.BRANCHES,
            action: 'UPDATE',
            description: buildAuditDescription('Branches', `Updated branch "${payload.branch_name}".`),
            tableName: 'branches',
          },
        })
        setSuccess('Branch updated successfully.')
      } else {
        await apiFetch<{ data: BranchRow; message?: string }>('/api/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
          audit: {
            page: AUDIT_PAGES.BRANCHES,
            action: 'INSERT',
            description: buildAuditDescription('Branches', `Created branch "${payload.branch_name}".`),
            tableName: 'branches',
          },
        })
        setSuccess('Branch created successfully.')
      }

      setEditingId(null)
      setForm(initialForm)
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
              <p className="audit-card-description">Create and manage branch locations. Each branch has its own products, stock, and sales.</p>
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
            <ThemedDataGrid variant="users">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.branch_id}>
                      <td>{row.branch_id}</td>
                      <td>{row.branch_code}</td>
                      <td>{row.branch_name}</td>
                      <td>{row.address || '-'}</td>
                      <td>{row.is_active ? 'Active' : 'Inactive'}</td>
                      <td>
                        <div className="table-actions">
                          <button className="terminal-action" type="button" onClick={() => handleEdit(row)}>
                            <ButtonLabel icon="edit">Edit</ButtonLabel>
                          </button>
                          <button
                            type="button"
                            className="terminal-action stock-batch-delete-button"
                            onClick={() => handleOpenDeleteModal(row)}
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
                  <h2>{editingId ? 'Edit Branch' : 'Add Branch'}</h2>
                  <p>New branches start with an empty catalog and inventory.</p>
                </div>
              </div>

              <form className="settings-form-grid" onSubmit={handleSubmit}>
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
                      <p className="field-hint">A unique code (for example BR001) is assigned automatically when you save.</p>
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
                  <label htmlFor="address">Address</label>
                  <input
                    id="address"
                    name="address"
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="is_active">
                    <input
                      id="is_active"
                      name="is_active"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />{' '}
                    Active
                  </label>
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
