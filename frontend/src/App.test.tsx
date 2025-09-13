import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// Mock all the UI components
vi.mock('@/shared/components', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">App Sidebar</div>,
  LoginPage: () => <div data-testid="login-page">Login Page</div>,
}))

vi.mock('@/shared/components/layout/about-modal', () => ({
  AboutModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => 
    isOpen ? <div data-testid="about-modal" onClick={onClose}>About Modal</div> : null,
}))

vi.mock('@/shared/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => <div data-testid="breadcrumb">{children}</div>,
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BreadcrumbLink: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BreadcrumbSeparator: () => <span>/</span>,
}))

vi.mock('@/shared/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => 
    <button type="button" onClick={onClick}>{children}</button>,
}))

vi.mock('@/shared/components/ui/separator', () => ({
  Separator: () => <div data-testid="separator">|</div>,
}))

vi.mock('@/shared/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar">{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-inset">{children}</div>,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarTrigger: () => <button type="button" data-testid="sidebar-trigger">Toggle</button>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuSubButton: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-footer">{children}</div>,
  SidebarRail: () => <div />,
}))

vi.mock('@/shared/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}))

vi.mock('@/shared/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => 
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-description">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
}))

vi.mock('@/shared/utils', () => ({
  ApiClient: class MockApiClient {
    get = vi.fn()
    post = vi.fn()
    put = vi.fn()
    delete = vi.fn()
  },
  useApiClient: () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// Mock auth context with different states
const mockAuthContext = {
  isAuthenticated: false,
  user: null,
  logout: vi.fn(),
  isLoading: false,
}

vi.mock('@/shared/contexts', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => mockAuthContext,
}))

// Mock all page components to prevent async operations
vi.mock('@/features/dashboard', () => ({
  DashboardPage: () => <div data-testid="dashboard-page">Dashboard Page</div>,
}))

vi.mock('@/features/administration', () => ({
  TenantsPage: () => <div data-testid="tenants-page">Tenants Page</div>,
  UsersPage: () => <div data-testid="users-page">Users Page</div>,
}))

vi.mock('@/features/data-management', () => ({
  DataManagementPage: () => <div data-testid="data-management-page">Data Management Page</div>,
}))

vi.mock('@/features/observability', () => ({
  ObservabilityLogsPage: () => <div data-testid="logs-page">Logs Page</div>,
  ObservabilityMetricsPage: () => <div data-testid="metrics-page">Metrics Page</div>,
  ObservabilityOverviewPage: () => <div data-testid="overview-page">Overview Page</div>,
  ObservabilityTracesPage: () => <div data-testid="traces-page">Traces Page</div>,
}))

vi.mock('@/features/playground', () => ({
  PlaygroundPage: () => <div data-testid="playground-page">Playground Page</div>,
}))

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div data-testid="browser-router">{children}</div>,
    Routes: ({ children }: { children: React.ReactNode }) => <div data-testid="routes">{children}</div>,
    Route: () => <div data-testid="route" />,
    useLocation: () => ({ pathname: '/' }),
  }
})

// Mock sonner
vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state when authentication is loading', () => {
    mockAuthContext.isLoading = true
    mockAuthContext.isAuthenticated = false

    render(<App />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows login page when user is not authenticated', () => {
    mockAuthContext.isLoading = false
    mockAuthContext.isAuthenticated = false

    render(<App />)

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument()
  })

  it('shows main app content when user is authenticated', () => {
    mockAuthContext.isLoading = false
    mockAuthContext.isAuthenticated = true
    mockAuthContext.user = { name: 'Test User' }

    render(<App />)

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-inset')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('renders app with AuthProvider wrapper', () => {
    render(<App />)

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument()
  })
})
