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

function BranchesPage() {
  usePageVisitAudit('Branches')
  const [rows, setRows] = useState<BranchRow[]>([])
  const [form, setForm] = useState<BranchForm>(initialForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.branch_code.trim() || !form.branch_name.trim()) {
      setError('Branch code and name are required.')
      return
    }

    try {
      setIsSaving(true)
      const payload = {
        branch_code: form.branch_code.trim(),
        branch_name: form.branch_name.trim(),
        address: form.address.trim(),
        is_active: form.is_active,
      }

      if (editingId) {
        await apiFetch<{ data: BranchRow; message?: string }>(`/api/branches/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          audit: {
            page: AUDIT_PAGES.USERS,
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
            page: AUDIT_PAGES.USERS,
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
                        <button className="terminal-action" type="button" onClick={() => handleEdit(row)}>
                          <ButtonLabel icon="edit">Edit</ButtonLabel>
                        </button>
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
                  <input
                    id="branch_code"
                    name="branch_code"
                    value={form.branch_code}
                    onChange={(event) => setForm((current) => ({ ...current, branch_code: event.target.value }))}
                    disabled={Boolean(editingId)}
                  />
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
    </AdminShell>
  )
}

export default BranchesPage
