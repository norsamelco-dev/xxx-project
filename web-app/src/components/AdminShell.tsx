import { Link, NavLink } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { ButtonLabel } from './ButtonIcon'
import { ThemedButton } from './ThemedButton'
import { themeList } from '../themes'
import { useTheme } from '../context/useTheme'
import type { ThemeId } from '../themes/types'

type AdminShellProps = {
  title: string
  description: string
  children: ReactNode
  actions?: ReactNode
  hideTopbar?: boolean
}

type ReceiptHeadingBrand = {
  busi_name: string | null
  business_logo_path: string | null
}

const uiScaleStorageKey = 'pos_ui_scale'
const minUiScale = 0.85
const maxUiScale = 1.2
const uiScaleStep = 0.05

function parseStoredUiScale(value: string | null) {
  if (!value) {
    return 1
  }

  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    return 1
  }

  return Math.min(maxUiScale, Math.max(minUiScale, parsed))
}

function roundUiScale(value: number) {
  return Math.round(value * 100) / 100
}

const navigationSections = [
  {
    label: 'General',
    items: [
      { to: '/dashboard-x', label: 'Dashboard', accessKey: 'dashboardX' },
      { to: '/audit-logs', label: 'Audit Logs', accessKey: 'auditLogs' },
      { to: '/inventory', label: 'Inventory Workspace', accessKey: 'products' },
      { to: '/damage-reports', label: 'Damage Reports', accessKey: 'damageReports' },
      { to: '/procurement', label: 'Procurement', accessKey: 'procurement' },
      { to: '/sales-report', label: 'Sales Report', accessKey: 'salesReport' },
      { to: '/branches', label: 'Branches', accessKey: 'branches' },
      { to: '/users', label: 'Users', accessKey: 'users' },
      { to: '/receipt-heading', label: 'Business Profile Settings', accessKey: 'receiptHeading' },
      { to: '/machine-terminal-registration', label: 'Machine / Terminal Registration', accessKey: 'machineTerminalRegistration' },
    ],
  },
]

function hasFullAdminAccess(username?: string, role?: string) {
  const normalizedUsername = String(username || '').trim().toLowerCase()
  return role === 'Admin' && (normalizedUsername === 'admin' || normalizedUsername === 'administrator')
}

function AdminShell({ title, description, children, actions, hideTopbar = false }: AdminShellProps) {
  const { user, logout } = useAuth()
  const { theme, themeId, defaultThemeId, setThemeId, resetToDefault } = useTheme()
  const [brand, setBrand] = useState<ReceiptHeadingBrand | null>(null)
  const [brandIconSize, setBrandIconSize] = useState(44)
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false)
  const [uiScale, setUiScale] = useState(() => parseStoredUiScale(localStorage.getItem(uiScaleStorageKey)))
  const brandNameRef = useRef<HTMLElement | null>(null)
  const adminCanvasRef = useRef<HTMLElement | null>(null)
  const adminContentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void loadBrand()
  }, [])

  useEffect(() => {
    const canvas = adminCanvasRef.current
    const content = adminContentRef.current
    if (!canvas || !content) {
      return
    }

    function syncAdminViewportFill() {
      window.requestAnimationFrame(() => {
        const canvasEl = adminCanvasRef.current
        const contentEl = adminContentRef.current
        if (!canvasEl || !contentEl) {
          return
        }

        const contentHeight = Math.max(0, Math.round(contentEl.clientHeight))
        canvasEl.style.setProperty('--admin-viewport-fill', `${contentHeight}px`)

        const chrome = contentEl.querySelector('.dashboardx-shell__chrome')
        const chromeHeight = chrome ? Math.round(chrome.getBoundingClientRect().height) : 0
        canvasEl.style.setProperty('--admin-chrome-offset', `${chromeHeight}px`)
      })
    }

    syncAdminViewportFill()

    const resizeObserver = new ResizeObserver(syncAdminViewportFill)
    resizeObserver.observe(content)

    const pageFrame = content.querySelector('.admin-page-frame')
    if (pageFrame) {
      resizeObserver.observe(pageFrame)
    }

    window.addEventListener('resize', syncAdminViewportFill)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncAdminViewportFill)
    }
  }, [hideTopbar, uiScale])

  useEffect(() => {
    function updateBrandIconSize() {
      const heading = brandNameRef.current
      if (!heading) {
        setBrandIconSize(44)
        return
      }

      const styles = window.getComputedStyle(heading)
      const fontSize = Number.parseFloat(styles.fontSize) || 16
      const lineHeight = Number.parseFloat(styles.lineHeight) || fontSize * 1.2
      const renderedHeight = heading.getBoundingClientRect().height
      const lines = Math.max(1, Math.round(renderedHeight / lineHeight))

      // Expand logo size as business name wraps to additional lines.
      const nextSize = Math.min(72, Math.max(44, Math.round(lineHeight * lines + 12)))
      setBrandIconSize(nextSize)
    }

    updateBrandIconSize()
    window.addEventListener('resize', updateBrandIconSize)

    return () => {
      window.removeEventListener('resize', updateBrandIconSize)
    }
  }, [brand?.busi_name])

  useEffect(() => {
    const nextScale = String(roundUiScale(uiScale))
    document.documentElement.style.setProperty('--ui-scale', nextScale)
    localStorage.setItem(uiScaleStorageKey, nextScale)
  }, [uiScale])

  const isBuiltInAdmin = hasFullAdminAccess(user?.username, user?.role)

  function canAccess(accessKey: keyof NonNullable<typeof user>['pageAccess']) {
    if (isBuiltInAdmin) {
      return true
    }

    if (!user?.pageAccess) {
      return true
    }

    return Boolean(user.pageAccess[accessKey])
  }

  async function handleLogout() {
    await logout()
  }

  async function loadBrand() {
    try {
      const payload = await apiFetch<{ data: ReceiptHeadingBrand | null }>('/api/receipt-heading/public')
      setBrand(payload.data)
    } catch (_error) {
      setBrand(null)
    }
  }

  function handleIncreaseUiScale() {
    setUiScale((current) => Math.min(maxUiScale, roundUiScale(current + uiScaleStep)))
  }

  function handleDecreaseUiScale() {
    setUiScale((current) => Math.max(minUiScale, roundUiScale(current - uiScaleStep)))
  }

  const brandName = brand?.busi_name?.trim() || 'Business Name'
  const brandInitial = brandName.charAt(0).toUpperCase() || 'B'

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          {brand?.business_logo_path ? (
            <img
              src={brand.business_logo_path}
              alt="Business logo"
              className="brand-logo"
              style={{ width: `${brandIconSize}px`, height: `${brandIconSize}px` }}
            />
          ) : (
            <div className="brand-mark" style={{ width: `${brandIconSize}px`, height: `${brandIconSize}px` }}>
              {brandInitial}
            </div>
          )}
          <div>
            <strong ref={brandNameRef}>{brandName}</strong>
            <span>Business console</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navigationSections.map((section) => (
            <div key={section.label} className="sidebar-group">
              <span className="sidebar-group-label">{section.label}</span>
              <div className="sidebar-links">
                {section.items.map((item) => (
                  canAccess(item.accessKey as keyof NonNullable<typeof user>['pageAccess']) ? (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                      <span className="sidebar-link-bullet" />
                      {item.label}
                    </NavLink>
                  ) : null
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>
            <strong>{user?.fullName || user?.username || 'Signed in user'}</strong>
            <span>{user?.role || 'User'}</span>
          </div>
          <button
            className="sidebar-settings"
            type="button"
            onClick={() => setIsDisplaySettingsOpen(true)}
          >
            <ButtonLabel icon="settings">Display Settings</ButtonLabel>
          </button>
          <button className="sidebar-logout" type="button" onClick={handleLogout}>
            <ButtonLabel icon="logout">Sign out</ButtonLabel>
          </button>
        </div>
      </aside>

      <section className="admin-canvas" ref={adminCanvasRef}>
        {!hideTopbar ? (
          <header className="admin-topbar">
            <div>
              <p className="admin-breadcrumb">Dashboard / {title}</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>

            <div className="admin-topbar-actions">
              <label className="admin-search" aria-label="Search">
                <span>Search</span>
                <input type="search" placeholder="Search modules, tables, settings" />
              </label>
              {actions}
              <Link className="admin-user-chip" to="/dashboard-x" aria-label="Current user">
                <span className="admin-user-avatar">{(user?.fullName || user?.username || 'U').charAt(0)}</span>
                <span>
                  <strong>{user?.fullName || user?.username || 'User'}</strong>
                  <small>{user?.role || 'Admin'}</small>
                </span>
              </Link>
            </div>
          </header>
        ) : null}

        <div className="admin-content" ref={adminContentRef}>
          <div className="admin-page-frame">{children}</div>
        </div>
      </section>

      {isDisplaySettingsOpen ? (
        <div className="terminal-modal-backdrop" role="presentation" onClick={() => setIsDisplaySettingsOpen(false)}>
          <div className="terminal-modal display-settings-shell" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <article className="panel settings-card display-settings-modal">
              <div className="panel-header">
                <div>
                  <h2>Display Settings</h2>
                  <p>Choose a client theme and adjust page scale in your browser view.</p>
                </div>
              </div>

              <div className="display-settings-section">
                <div className="display-settings-section__header">
                  <h3>Client theme</h3>
                  <p>
                    Active: <strong>{theme.label}</strong> · Build default: <strong>{defaultThemeId}</strong>
                  </p>
                </div>

                <div className="theme-picker-grid" role="listbox" aria-label="Client theme">
                  {themeList.map((entry) => {
                    const isActive = entry.id === themeId
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={`theme-picker-card ${isActive ? 'active' : ''}`}
                        onClick={() => setThemeId(entry.id as ThemeId)}
                      >
                        <span className="theme-picker-card__swatches">
                          <span style={{ background: entry.colors.primary }} />
                          <span style={{ background: entry.colors.accent }} />
                          <span style={{ background: entry.colors.secondary }} />
                        </span>
                        <strong>{entry.label}</strong>
                        <small>{entry.id}</small>
                      </button>
                    )
                  })}
                </div>

                <div className="display-settings-theme-actions">
                  <ThemedButton type="button" variant="secondary" onClick={resetToDefault}>
                    Reset to build default
                  </ThemedButton>
                </div>
              </div>

              <div className="display-settings-divider" />

              <div className="display-settings-section">
                <div className="display-settings-section__header">
                  <h3>UI scale</h3>
                  <p>Adjust page font size and layout scale.</p>
                </div>
                <div className="display-settings-value">{Math.round(uiScale * 100)}%</div>
                <div className="settings-actions">
                  <ThemedButton
                    type="button"
                    variant="secondary"
                    onClick={handleDecreaseUiScale}
                    disabled={uiScale <= minUiScale}
                  >
                    <ButtonLabel icon="minus">Decrease</ButtonLabel>
                  </ThemedButton>
                  <ThemedButton
                    type="button"
                    variant="primary"
                    onClick={handleIncreaseUiScale}
                    disabled={uiScale >= maxUiScale}
                  >
                    <ButtonLabel icon="plus">Increase</ButtonLabel>
                  </ThemedButton>
                </div>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default AdminShell