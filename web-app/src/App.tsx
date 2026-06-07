import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import AuditLogsPage from './pages/AuditLogsPage'
import DashboardXPage from './pages/DashboardXPage'
import InventoryWorkspacePage from './pages/InventoryWorkspacePage'
import DamageReportsWorkspacePage from './pages/DamageReportsWorkspacePage'
import DamageReportEditorPage from './pages/DamageReportEditorPage'
import ProcurementWorkspacePage from './pages/ProcurementWorkspacePage'
import ProcurementRequisitionEditorPage from './pages/ProcurementRequisitionEditorPage'
import ProcurementOrderEditorPage from './pages/ProcurementOrderEditorPage'
import ProcurementReceivingEditorPage from './pages/ProcurementReceivingEditorPage'
import LoginPage from './pages/LoginPage'
import MachineTerminalRegistrationPage from './pages/MachineTerminalRegistrationPage'
import ReceiptHeadingPage from './pages/ReceiptHeadingPage'
import SalesReportPage from './pages/SalesReportPage'
import UsersPage from './pages/UsersPage'
import BranchesPage from './pages/BranchesPage'

function App() {
  const { status } = useAuth()

  if (status === 'checking') {
    return (
      <main className="auth-shell auth-shell--centered">
        <section className="auth-card auth-card--status">
          <span className="eyebrow">Session check</span>
          <h1>Checking your current sign-in state...</h1>
          <p>The browser is confirming whether an active session already exists.</p>
        </section>
      </main>
    )
  }

  const homePath = status === 'authenticated' ? '/dashboard-x' : '/login'

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homePath} replace />} />
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to="/dashboard-x" replace /> : <LoginPage />}
      />
      <Route
        path="/dashboard-x"
        element={
          <ProtectedRoute requiredAccess="dashboardX">
            <DashboardXPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute requiredAccess="auditLogs">
            <AuditLogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute requiredAccess="products">
            <InventoryWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute requiredAccess="products">
            <Navigate to="/inventory?tab=products" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-stock-batch"
        element={
          <ProtectedRoute requiredAccess="products">
            <Navigate to="/inventory?tab=add-stock-batch" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sync-history"
        element={
          <ProtectedRoute requiredAccess="products">
            <Navigate to="/inventory?tab=sync-history" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/damage-reports"
        element={
          <ProtectedRoute requiredAccess="damageReports">
            <DamageReportsWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/damage-reports/:id"
        element={
          <ProtectedRoute requiredAccess="damageReports">
            <DamageReportEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/procurement"
        element={
          <ProtectedRoute requiredAccess="procurement">
            <ProcurementWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/procurement/requisitions/:id"
        element={
          <ProtectedRoute requiredAccess="procurement">
            <ProcurementRequisitionEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/procurement/orders/:id"
        element={
          <ProtectedRoute requiredAccess="procurement">
            <ProcurementOrderEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/procurement/receiving/:id"
        element={
          <ProtectedRoute requiredAccess="procurement">
            <ProcurementReceivingEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales-report"
        element={
          <ProtectedRoute requiredAccess="salesReport">
            <SalesReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/branches"
        element={
          <ProtectedRoute requiredAccess="branches">
            <BranchesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredAccess="users">
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receipt-heading"
        element={
          <ProtectedRoute requiredAccess="receiptHeading">
            <ReceiptHeadingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/machine-terminal-registration"
        element={
          <ProtectedRoute requiredAccess="machineTerminalRegistration">
            <MachineTerminalRegistrationPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={homePath} replace />} />
    </Routes>
  )
}

export default App
