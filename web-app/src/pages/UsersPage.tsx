import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ThemedDataGrid } from '../components/ThemedDataGrid'
import { ThemedButton } from '../components/ThemedButton'
import AdminShell from '../components/AdminShell'
import { ButtonLabel } from '../components/ButtonIcon'
import { usePageVisitAudit } from '../hooks/usePageVisitAudit'
import { apiFetch } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'
import { useAuth } from '../context/AuthContext'

type UserRow = {
  user_id: number
  username: string
  role: string
  full_name: string | null
  ACTIVE: number
  created_at: string | null
  PAGE_ACCESS_JSON: string | null
  branch_id: number
  branch_code?: string
  branch_name?: string
}

type BranchOption = {
  branch_id: number
  branch_code: string
  branch_name: string
}

type UsersResponse = {
  data: UserRow[]
  roles: string[]
}

type UserForm = {
  username: string
  password: string
  role: string
  full_name: string
  ACTIVE: boolean
  branch_id: string
  ACCESS_DASHBOARD_X: boolean
  ACCESS_AUDIT_LOGS: boolean
  ACCESS_PRODUCTS: boolean
  ACCESS_SALES_REPORT: boolean
  ACCESS_USERS: boolean
  ACCESS_RECEIPT_HEADING: boolean
  ACCESS_MACHINE_TERMINAL_REGISTRATION: boolean
  ACCESS_DAMAGE_REPORTS: boolean
  ACCESS_PROCUREMENT: boolean
  ACCESS_BRANCHES: boolean
}

const initialForm: UserForm = {
  username: '',
  password: '',
  role: 'Cashier',
  full_name: '',
  ACTIVE: true,
  branch_id: '',
  ACCESS_DASHBOARD_X: false,
  ACCESS_AUDIT_LOGS: false,
  ACCESS_PRODUCTS: false,
  ACCESS_SALES_REPORT: false,
  ACCESS_USERS: false,
  ACCESS_RECEIPT_HEADING: false,
  ACCESS_MACHINE_TERMINAL_REGISTRATION: false,
  ACCESS_DAMAGE_REPORTS: false,
  ACCESS_PROCUREMENT: false,
  ACCESS_BRANCHES: false,
}

type PageAccess = {
  dashboardX: boolean
  auditLogs: boolean
  products: boolean
  salesReport: boolean
  users: boolean
  receiptHeading: boolean
  machineTerminalRegistration: boolean
  damageReports: boolean
  procurement: boolean
  branches: boolean
}

function parsePageAccess(value: string | null): PageAccess {
  if (!value) {
    return {
      dashboardX: false,
      auditLogs: false,
      products: false,
      salesReport: false,
      users: false,
      receiptHeading: false,
      machineTerminalRegistration: false,
      damageReports: false,
      procurement: false,
      branches: false,
    }
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') {
      return {
        dashboardX: Boolean((parsed as { dashboardX?: boolean }).dashboardX),
        auditLogs: Boolean((parsed as { auditLogs?: boolean }).auditLogs),
        products: Boolean((parsed as { products?: boolean }).products),
        salesReport: Boolean((parsed as { salesReport?: boolean }).salesReport),
        users: Boolean((parsed as { users?: boolean }).users),
        receiptHeading: Boolean((parsed as { receiptHeading?: boolean }).receiptHeading),
        machineTerminalRegistration: Boolean((parsed as { machineTerminalRegistration?: boolean }).machineTerminalRegistration),
      damageReports: Boolean((parsed as { damageReports?: boolean }).damageReports),
      procurement: Boolean((parsed as { procurement?: boolean }).procurement),
      branches: Boolean((parsed as { branches?: boolean }).branches),
    }
    }
  } catch (_error) {
    // Fallback to all false for malformed JSON.
  }

  return {
    dashboardX: false,
    auditLogs: false,
    products: false,
    salesReport: false,
    users: false,
    receiptHeading: false,
    machineTerminalRegistration: false,
    damageReports: false,
    procurement: false,
    branches: false,
  }
}

function pageAccessLabels(value: string | null): string[] {
  const parsed = parsePageAccess(value)
  const labels: string[] = []

  if (parsed.dashboardX) labels.push('DashboardX')
  if (parsed.auditLogs) labels.push('Audit Logs')
  if (parsed.products) labels.push('Inventory Workspace')
  if (parsed.salesReport) labels.push('Sales Report')
  if (parsed.users) labels.push('Users')
  if (parsed.receiptHeading) labels.push('Business Profile Settings')
  if (parsed.machineTerminalRegistration) labels.push('Machine / Terminal Registration')
  if (parsed.damageReports) labels.push('Damage Reports')
  if (parsed.procurement) labels.push('Procurement')
  if (parsed.branches) labels.push('Branches')

  return labels
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

function normalizeRole(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function getRoleAvatar(role: string) {
  const normalized = normalizeRole(role)

  if (normalized === 'admin') {
    return {
      className: 'users-avatar users-avatar--admin',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3l7 3v5c0 4.4-2.7 7.8-7 10-4.3-2.2-7-5.6-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    }
  }

  if (normalized === 'cashier') {
    return {
      className: 'users-avatar users-avatar--cashier',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 4h10v4H7z" />
          <path d="M5 8h14v11H5z" />
          <path d="M8 12h8" />
          <path d="M8 15h5" />
        </svg>
      ),
    }
  }

  if (normalized === 'manager') {
    return {
      className: 'users-avatar users-avatar--manager',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 8h16v10H4z" />
          <path d="M9 8V6h6v2" />
          <path d="M4 12h16" />
          <path d="M11 12h2" />
        </svg>
      ),
    }
  }

  if (normalized === 'auditor') {
    return {
      className: 'users-avatar users-avatar--auditor',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8 4h8l3 3v13H5V4z" />
          <path d="M8 11h8" />
          <path d="M8 15h4" />
          <path d="M15 15l1.5 1.5L19 14" />
        </svg>
      ),
    }
  }

  return {
    className: 'users-avatar users-avatar--default',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    ),
  }
}

function mapRowToForm(row: UserRow): UserForm {
  const access = parsePageAccess(row.PAGE_ACCESS_JSON)

  return {
    username: row.username || '',
    password: '',
    role: row.role || 'Cashier',
    full_name: row.full_name || '',
    ACTIVE: Boolean(row.ACTIVE),
    branch_id: String(row.branch_id || ''),
    ACCESS_DASHBOARD_X: access.dashboardX,
    ACCESS_AUDIT_LOGS: access.auditLogs,
    ACCESS_PRODUCTS: access.products,
    ACCESS_SALES_REPORT: access.salesReport,
    ACCESS_USERS: access.users,
    ACCESS_RECEIPT_HEADING: access.receiptHeading,
    ACCESS_MACHINE_TERMINAL_REGISTRATION: access.machineTerminalRegistration,
    ACCESS_DAMAGE_REPORTS: access.damageReports,
    ACCESS_PROCUREMENT: access.procurement,
    ACCESS_BRANCHES: access.branches,
  }
}

function UsersPage() {
  const { user } = useAuth()
  usePageVisitAudit(AUDIT_PAGES.USERS)
  const defaultBranchFilterId = user?.branchId ? String(user.branchId) : ''
  const [rows, setRows] = useState<UserRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [branchFilterId, setBranchFilterId] = useState(defaultBranchFilterId)
  const [roles, setRoles] = useState<string[]>(['Admin', 'Cashier', 'manager', 'Auditor'])
  const [form, setForm] = useState<UserForm>(initialForm)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (user?.branchId) {
      setBranchFilterId(String(user.branchId))
    }
  }, [user?.branchId])

  useEffect(() => {
    if (!user) {
      return
    }
    void loadRows(branchFilterId)
  }, [branchFilterId, user?.userId])

  useEffect(() => {
    void loadBranches()
  }, [])

  async function loadBranches() {
    try {
      const response = await apiFetch<{ data: BranchOption[] }>('/api/branches')
      setBranches(response.data || [])
    } catch {
      setBranches([])
    }
  }

  async function loadRows(filterBranchId = branchFilterId) {
    try {
      setError('')
      setIsLoading(true)
      const query = filterBranchId ? `?branch_id=${encodeURIComponent(filterBranchId)}` : ''
      const response = await apiFetch<UsersResponse>(`/api/users${query}`)
      setRows(response.data || [])
      setRoles(response.roles || ['Admin', 'Cashier', 'manager', 'Auditor'])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load users.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleAddNew() {
    setSelectedRowId(null)
    setEditingId(null)
    setDeletePassword('')
    setForm({
      ...initialForm,
      branch_id: branchFilterId || (user?.branchId ? String(user.branchId) : ''),
    })
    setSuccess('')
    setError('')
    setIsDeleteModalOpen(false)
    setIsFormOpen(true)
  }

  function handleEdit(row: UserRow) {
    setSelectedRowId(row.user_id)
    setEditingId(row.user_id)
    setDeletePassword('')
    setForm(mapRowToForm(row))
    setSuccess('')
    setError('')
    setIsDeleteModalOpen(false)
    setIsFormOpen(true)
  }

  function handleCancelForm() {
    setEditingId(null)
    setDeletePassword('')
    setForm(initialForm)
    setIsDeleteModalOpen(false)
    setIsFormOpen(false)
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

  async function handleDelete() {
    if (!editingId) {
      return
    }

    if (!deletePassword) {
      setError('Password is required to delete this user.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setIsDeleting(true)
      await apiFetch<{ message: string }>(`/api/users/${editingId}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
        audit: {
          page: AUDIT_PAGES.USERS,
          action: 'DELETE',
          description: buildAuditDescription(
            AUDIT_PAGES.USERS,
            `Deleted user "${form.username}" (ID ${editingId}).`,
          ),
          tableName: 'users',
        },
      })

      setSuccess('User deleted successfully.')
      setSelectedRowId(null)
      setEditingId(null)
      setDeletePassword('')
      setForm(initialForm)
      setIsDeleteModalOpen(false)
      setIsFormOpen(false)
      await loadRows(branchFilterId)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete user record.')
    } finally {
      setIsDeleting(false)
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = event.target
    const checked = type === 'checkbox' ? (event.target as HTMLInputElement).checked : false

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.username.trim()) {
      setError('Username is required.')
      return
    }

    if (!form.role.trim()) {
      setError('Role is required.')
      return
    }

    if (!form.branch_id) {
      setError('Branch is required.')
      return
    }

    if (!editingId && !form.password.trim()) {
      setError('Password is required for new users.')
      return
    }

    try {
      setIsSaving(true)

      const payload = {
        username: form.username,
        password: form.password,
        role: form.role,
        full_name: form.full_name,
        ACTIVE: form.ACTIVE,
        branch_id: Number(form.branch_id),
        PAGE_ACCESS_JSON: {
          dashboardX: form.ACCESS_DASHBOARD_X,
          auditLogs: form.ACCESS_AUDIT_LOGS,
          products: form.ACCESS_PRODUCTS,
          salesReport: form.ACCESS_SALES_REPORT,
          users: form.ACCESS_USERS,
          receiptHeading: form.ACCESS_RECEIPT_HEADING,
          machineTerminalRegistration: form.ACCESS_MACHINE_TERMINAL_REGISTRATION,
          damageReports: form.ACCESS_DAMAGE_REPORTS,
          procurement: form.ACCESS_PROCUREMENT,
          branches: form.ACCESS_BRANCHES,
        },
      }

      const endpoint = editingId ? `/api/users/${editingId}` : '/api/users'
      const method = editingId ? 'PUT' : 'POST'

      const response = await apiFetch<{ data: UserRow; message: string }>(endpoint, {
        method,
        body: JSON.stringify(payload),
        audit: {
          page: AUDIT_PAGES.USERS,
          action: editingId ? 'UPDATE' : 'INSERT',
          description: buildAuditDescription(
            AUDIT_PAGES.USERS,
            editingId
              ? `Updated user "${form.username.trim()}" (role ${form.role.trim()}).`
              : `Created user "${form.username.trim()}" (role ${form.role.trim()}).`,
          ),
          tableName: 'users',
        },
      })

      setSuccess(response.message || 'User saved successfully.')
      setEditingId(null)
      setForm(initialForm)
      setIsFormOpen(false)
      await loadRows(branchFilterId)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save user record.')
    } finally {
      setIsSaving(false)
    }
  }

  const currentEditingRow = editingId ? rows.find((row) => row.user_id === editingId) || null : null
  const currentSessionUserId = user?.userId || null
  const canDeleteCurrentEditUser = Boolean(currentEditingRow && currentEditingRow.user_id !== currentSessionUserId)

  return (
    <AdminShell title="Users" description="Manage system users and access controls." hideTopbar>
      <section className="settings-stack">
        {error ? <div className="error-state">{error}</div> : null}
        {success ? <div className="success-state">{success}</div> : null}

        <article className="surface-card surface-card--wide">
          <div className="audit-card-header">
            <div>
              <p className="admin-breadcrumb">Dashboard / Users</p>
              <h1 className="audit-card-title">Users</h1>
              <p className="audit-card-description">Add, edit, and delete users in the users table.</p>
            </div>

            <div className="audit-card-actions">
              <label className="field" style={{ marginBottom: 0, minWidth: 220 }}>
                <span style={{ display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.8 }}>Branch</span>
                <select
                  value={branchFilterId}
                  onChange={(event) => setBranchFilterId(event.target.value)}
                  aria-label="Filter users by branch"
                >
                  <option value="">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name} ({branch.branch_code})
                    </option>
                  ))}
                </select>
              </label>
              <button className="topbar-button topbar-button--ghost" type="button" onClick={() => void loadRows(branchFilterId)}>
                <ButtonLabel icon="reload">Reload</ButtonLabel>
              </button>
              <button className="topbar-button" type="button" onClick={handleAddNew}>
                <ButtonLabel icon="plus">Add User</ButtonLabel>
              </button>
            </div>
          </div>

          {isLoading ? <div className="empty-state">Loading users...</div> : null}
          {!isLoading && rows.length === 0 ? <div className="empty-state">No user records found.</div> : null}

          {!isLoading && rows.length > 0 ? (
            <ThemedDataGrid variant="users">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Avatar</th>
                    <th>Username / Name</th>
                    <th>Role</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Permissions</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const permissionLabels = pageAccessLabels(row.PAGE_ACCESS_JSON)
                    const avatar = getRoleAvatar(row.role)

                    return (
                      <tr key={row.user_id} className={selectedRowId === row.user_id ? 'terminal-row-selected' : ''}>
                        <td>{row.user_id}</td>
                        <td className="users-avatar-cell">
                          <span className={avatar.className} title={row.role || 'User'} aria-label={`${row.role || 'User'} avatar`}>
                            {avatar.icon}
                          </span>
                        </td>
                        <td>
                          <div><strong>{row.username}</strong></div>
                          <div>{row.full_name || ''}</div>
                        </td>
                        <td>{row.role}</td>
                        <td>{row.branch_name || row.branch_code || row.branch_id}</td>
                        <td>{row.ACTIVE ? 'Active' : 'Inactive'}</td>
                        <td>
                          {permissionLabels.length === 0 ? (
                            '-'
                          ) : (
                            <div className="permissions-wrap">
                              {permissionLabels.map((label, index) => (
                                <div key={`${row.user_id}-${label}`} className="permissions-item">
                                  <span className="permission-chip">{label}</span>
                                  {index < permissionLabels.length - 1 ? (
                                    <span className="permission-separator" aria-hidden="true">|</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{toInputDateTime(row.created_at)}</td>
                        <td>
                          <div className="table-actions">
                            <button className="terminal-action" type="button" onClick={() => handleEdit(row)}>
                              <ButtonLabel icon="edit">Edit</ButtonLabel>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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
                  <h2>{editingId ? 'Edit User' : 'Add User'}</h2>
                  <p>Manage user profile, role, and access flags.</p>
                </div>

                {editingId && canDeleteCurrentEditUser ? (
                  <button type="button" className="product-delete-trigger" onClick={handleOpenDeleteModal} disabled={isDeleting || isSaving}>
                    <ButtonLabel icon="delete">Delete</ButtonLabel>
                  </button>
                ) : null}
              </div>

              <form className="settings-form-grid" onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="username">Username</label>
                  <input id="username" name="username" value={form.username} onChange={handleChange} />
                </div>
                <div className="field">
                  <label htmlFor="password">{editingId ? 'New password (optional)' : 'Password'}</label>
                  <input id="password" name="password" type="password" value={form.password} onChange={handleChange} />
                </div>
                <div className="field">
                  <label htmlFor="full_name">Full name</label>
                  <input id="full_name" name="full_name" value={form.full_name} onChange={handleChange} />
                </div>
                <div className="field">
                  <label htmlFor="role">Role</label>
                  <select id="role" name="role" value={form.role} onChange={handleChange}>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="branch_id">Branch</label>
                  <select id="branch_id" name="branch_id" value={form.branch_id} onChange={handleChange}>
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch.branch_id} value={branch.branch_id}>
                        {branch.branch_name} ({branch.branch_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field field--full user-toggle-row">
                  <label htmlFor="ACTIVE">Active Account</label>
                  <label className="user-toggle-switch" aria-label="Toggle account active status">
                    <input id="ACTIVE" name="ACTIVE" type="checkbox" checked={form.ACTIVE} onChange={handleChange} />
                    <span className="user-toggle-slider" aria-hidden="true" />
                  </label>
                </div>

                <section className="field field--full user-permissions-panel" aria-label="Page permissions">
                  <div className="user-permissions-header">
                    <h3>Page Permissions</h3>
                    <p>Choose the pages this account can access.</p>
                  </div>

                  <div className="user-permissions-grid">
                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_DASHBOARD_X">DashboardX</label>
                      <label className="user-toggle-switch" aria-label="Toggle dashboardx permission">
                        <input id="ACCESS_DASHBOARD_X" name="ACCESS_DASHBOARD_X" type="checkbox" checked={form.ACCESS_DASHBOARD_X} onChange={handleChange} />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_AUDIT_LOGS">Audit Logs</label>
                      <label className="user-toggle-switch" aria-label="Toggle audit logs permission">
                        <input id="ACCESS_AUDIT_LOGS" name="ACCESS_AUDIT_LOGS" type="checkbox" checked={form.ACCESS_AUDIT_LOGS} onChange={handleChange} />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_PRODUCTS">Inventory Workspace</label>
                      <label className="user-toggle-switch" aria-label="Toggle inventory workspace permission">
                        <input id="ACCESS_PRODUCTS" name="ACCESS_PRODUCTS" type="checkbox" checked={form.ACCESS_PRODUCTS} onChange={handleChange} />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_SALES_REPORT">Sales Report</label>
                      <label className="user-toggle-switch" aria-label="Toggle sales report permission">
                        <input
                          id="ACCESS_SALES_REPORT"
                          name="ACCESS_SALES_REPORT"
                          type="checkbox"
                          checked={form.ACCESS_SALES_REPORT}
                          onChange={handleChange}
                        />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_USERS">Users</label>
                      <label className="user-toggle-switch" aria-label="Toggle users permission">
                        <input id="ACCESS_USERS" name="ACCESS_USERS" type="checkbox" checked={form.ACCESS_USERS} onChange={handleChange} />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_RECEIPT_HEADING">Business Profile Settings</label>
                      <label className="user-toggle-switch" aria-label="Toggle receipt heading permission">
                        <input
                          id="ACCESS_RECEIPT_HEADING"
                          name="ACCESS_RECEIPT_HEADING"
                          type="checkbox"
                          checked={form.ACCESS_RECEIPT_HEADING}
                          onChange={handleChange}
                        />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_DAMAGE_REPORTS">Damage Reports</label>
                      <label className="user-toggle-switch" aria-label="Toggle damage reports permission">
                        <input
                          id="ACCESS_DAMAGE_REPORTS"
                          name="ACCESS_DAMAGE_REPORTS"
                          type="checkbox"
                          checked={form.ACCESS_DAMAGE_REPORTS}
                          onChange={handleChange}
                        />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_PROCUREMENT">Procurement</label>
                      <label className="user-toggle-switch" aria-label="Toggle procurement permission">
                        <input
                          id="ACCESS_PROCUREMENT"
                          name="ACCESS_PROCUREMENT"
                          type="checkbox"
                          checked={form.ACCESS_PROCUREMENT}
                          onChange={handleChange}
                        />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_BRANCHES">Branches</label>
                      <label className="user-toggle-switch" aria-label="Toggle branches permission">
                        <input
                          id="ACCESS_BRANCHES"
                          name="ACCESS_BRANCHES"
                          type="checkbox"
                          checked={form.ACCESS_BRANCHES}
                          onChange={handleChange}
                        />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>

                    <div className="user-toggle-row">
                      <label htmlFor="ACCESS_MACHINE_TERMINAL_REGISTRATION">Machine / Terminal Registration</label>
                      <label className="user-toggle-switch" aria-label="Toggle machine terminal registration permission">
                        <input
                          id="ACCESS_MACHINE_TERMINAL_REGISTRATION"
                          name="ACCESS_MACHINE_TERMINAL_REGISTRATION"
                          type="checkbox"
                          checked={form.ACCESS_MACHINE_TERMINAL_REGISTRATION}
                          onChange={handleChange}
                        />
                        <span className="user-toggle-slider" aria-hidden="true" />
                      </label>
                    </div>
                  </div>
                </section>

                <div className="settings-actions field--full">
                  <ThemedButton type="button" variant="secondary" onClick={handleCancelForm} disabled={isSaving}>
                    <ButtonLabel icon="cancel">Cancel</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton type="submit" variant="primary" disabled={isSaving || isDeleting}>
                    <ButtonLabel icon="save">{isSaving ? 'Saving...' : 'Save User'}</ButtonLabel>
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
                  <h2>Delete User</h2>
                  <p>Enter your password to permanently delete this user record.</p>
                </div>
              </div>

              <form
                className="settings-stack"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleDelete()
                }}
              >
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
        </div>
      ) : null}
    </AdminShell>
  )
}

export default UsersPage
