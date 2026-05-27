import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type PageAccessKey =
  | 'dashboardX'
  | 'auditLogs'
  | 'products'
  | 'salesReport'
  | 'users'
  | 'receiptHeading'
  | 'machineTerminalRegistration'
  | 'damageReports'
  | 'procurement'

type ProtectedRouteProps = {
  requiredAccess?: PageAccessKey
  children?: React.ReactElement
}

const ACCESS_DESTINATIONS: Array<{ key: PageAccessKey; path: string }> = [
  { key: 'dashboardX', path: '/dashboard-x' },
  { key: 'auditLogs', path: '/audit-logs' },
  { key: 'products', path: '/products' },
  { key: 'salesReport', path: '/sales-report' },
  { key: 'users', path: '/users' },
  { key: 'receiptHeading', path: '/receipt-heading' },
  { key: 'machineTerminalRegistration', path: '/machine-terminal-registration' },
  { key: 'damageReports', path: '/damage-reports' },
  { key: 'procurement', path: '/procurement' },
]

function hasFullAdminAccess(username?: string, role?: string) {
  const normalizedUsername = String(username || '').trim().toLowerCase()
  return role === 'Admin' && (normalizedUsername === 'admin' || normalizedUsername === 'administrator')
}

function ProtectedRoute({ requiredAccess, children }: ProtectedRouteProps) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (requiredAccess) {
    const isBuiltInAdmin = hasFullAdminAccess(user?.username, user?.role)
    const hasPageAccess = isBuiltInAdmin || !user?.pageAccess || Boolean(user.pageAccess[requiredAccess])

    if (!hasPageAccess) {
      const firstAllowed = ACCESS_DESTINATIONS.find((entry) => Boolean(user?.pageAccess?.[entry.key]))
      return <Navigate to={(firstAllowed?.path || '/dashboard-x')} replace />
    }
  }

  return children || <Outlet />
}

export default ProtectedRoute