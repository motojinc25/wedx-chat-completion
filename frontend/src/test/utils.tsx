import { type RenderOptions, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AuthProvider } from '@/shared/contexts'

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Mock authentication states for testing
export const mockAuthenticatedUser = {
  user_id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
  roles: ['user'],
}

export const mockUnauthenticatedState = {
  isAuthenticated: false,
  user: null,
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
}

export const mockAuthenticatedState = {
  isAuthenticated: true,
  user: mockAuthenticatedUser,
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false,
}

export const mockLoadingState = {
  isAuthenticated: false,
  user: null,
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: true,
}

