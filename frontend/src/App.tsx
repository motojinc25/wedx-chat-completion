import { useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { isAuthDisabled } from '@/config/auth-config'
import { TenantsPage, UsersPage } from '@/features/administration'
import { DashboardPage } from '@/features/dashboard'
import { DataManagementPage } from '@/features/data-management'
import {
  ObservabilityLogsPage,
  ObservabilityMetricsPage,
  ObservabilityOverviewPage,
  ObservabilityTracesPage,
} from '@/features/observability'
import { PlaygroundPage } from '@/features/playground'
import { AppSidebar, LoginPage } from '@/shared/components'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/shared/components/ui'
import { AuthProvider, useAuth } from '@/shared/contexts'

function AppContent() {
  const { isAuthenticated, user, logout, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <AppHeader
          user={user ? { name: user.name, username: user.username } : { name: '', username: '' }}
          logout={logout}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="/data-management" element={<DataManagementPage />} />
            <Route path="/administration/tenants" element={<TenantsPage />} />
            <Route path="/administration/users" element={<UsersPage />} />
            <Route path="/observability/overview" element={<ObservabilityOverviewPage />} />
            <Route path="/observability/logs" element={<ObservabilityLogsPage />} />
            <Route path="/observability/traces" element={<ObservabilityTracesPage />} />
            <Route path="/observability/metrics" element={<ObservabilityMetricsPage />} />
          </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppHeader({ user, logout }: { user: { name?: string; username?: string }; logout: () => void }) {
  const location = useLocation()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
      case '/dashboard':
        return 'Dashboard'
      case '/playground':
        return 'Chat Playground'
      case '/data-management':
        return 'Data Management'
      case '/administration/tenants':
        return 'Tenant Management'
      case '/administration/users':
        return 'User Management'
      case '/observability/overview':
        return 'Observability Overview'
      case '/observability/logs':
        return 'Observability Logs'
      case '/observability/traces':
        return 'Observability Traces'
      case '/observability/metrics':
        return 'Observability Metrics'
      default:
        return 'Page'
    }
  }

  const handleLogout = () => {
    setShowLogoutDialog(false)
    logout()
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="font-semibold text-base">{getPageTitle(location.pathname)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3">
          {isAuthDisabled && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
              DEMO MODE
            </Badge>
          )}
          <span className="text-sm text-muted-foreground hidden md:block">Welcome, {user?.name || user?.username}</span>
          <Button variant="outline" size="sm" onClick={() => setShowLogoutDialog(true)}>
            Sign out
          </Button>
        </div>
      </header>

      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Sign Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You will be logged out of your current session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogout}>Sign Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
