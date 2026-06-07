import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, onUnauthorized } from '../lib/api'
import { AUDIT_PAGES, buildAuditDescription } from '../lib/audit'

export type SessionUser = {
  userId: number
  username: string
  role: string
  fullName: string
  active: boolean
  createdAt: string
  branchId: number
  branchCode: string
  branchName: string
  pageAccess: {
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
}

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

type AuthContextValue = {
  status: AuthStatus
  user: SessionUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      setUser(null)
      setStatus('unauthenticated')
    })
    void refreshSession()
    return unsubscribe
  }, [])

  async function refreshSession() {
    try {
      const payload = await apiFetch<{ user: SessionUser }>('/api/auth/me')
      setUser(payload.user)
      setStatus('authenticated')
    } catch (_error) {
      setUser(null)
      setStatus('unauthenticated')
    }
  }

  async function login(username: string, password: string) {
    const payload = await apiFetch<{ user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      audit: {
        page: AUDIT_PAGES.LOGIN,
        action: 'LOGIN',
        description: buildAuditDescription(AUDIT_PAGES.LOGIN, `Signed in as "${username}".`),
        tableName: 'users',
      },
    })

    setUser(payload.user)
    setStatus('authenticated')
  }

  async function logout() {
    const currentUsername = user?.username || 'unknown user'

    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        audit: {
          page: 'Application',
          action: 'LOGOUT',
          description: buildAuditDescription('Application', `Signed out user "${currentUsername}".`),
          tableName: 'users',
        },
      })
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      logout,
      refreshSession,
    }),
    [status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }

  return context
}

export { AuthProvider, useAuth }