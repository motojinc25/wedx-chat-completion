import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './login-page'

// Mock the auth context
const mockLogin = vi.fn()
const mockAuthContext = {
  login: mockLogin,
  isLoading: false,
}

vi.mock('@/shared/contexts', () => ({
  useAuth: () => mockAuthContext,
}))

// Mock the Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { 
    children: React.ReactNode
    onClick: () => void
    disabled: boolean
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthContext.isLoading = false
  })

  it('renders login page with correct content', () => {
    render(<LoginPage />)

    expect(screen.getByText('WeDX')).toBeInTheDocument()
    expect(screen.getByText('Sign in with Microsoft account to continue')).toBeInTheDocument()
    expect(screen.getByText('Sign in with Microsoft')).toBeInTheDocument()
  })

  it('calls login function when sign in button is clicked', () => {
    render(<LoginPage />)

    const signInButton = screen.getByText('Sign in with Microsoft')
    fireEvent.click(signInButton)

    expect(mockLogin).toHaveBeenCalledTimes(1)
  })

  it('shows loading state when isLoading is true', () => {
    mockAuthContext.isLoading = true

    render(<LoginPage />)

    expect(screen.getByText('Signing in...')).toBeInTheDocument()
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

})
