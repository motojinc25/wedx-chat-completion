import {
  type AccountInfo,
  type AuthenticationResult,
  PublicClientApplication,
  type RedirectRequest,
} from '@azure/msal-browser'
import type React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { isAuthDisabled, loginRequest, msalConfig } from '@/config/auth-config'

interface AuthContextType {
  isAuthenticated: boolean
  user: AccountInfo | null
  login: () => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Create MSAL instance (only if auth is not disabled)
const msalInstance = isAuthDisabled ? null : new PublicClientApplication(msalConfig)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(isAuthDisabled)
  const [user, setUser] = useState<AccountInfo | null>(
    isAuthDisabled
      ? ({
          homeAccountId: 'demo-user',
          environment: 'demo',
          tenantId: 'demo-tenant',
          username: 'demo@example.com',
          localAccountId: 'demo-local',
          name: 'Demo User',
          idTokenClaims: {},
        } as AccountInfo)
      : null,
  )
  const [isLoading, setIsLoading] = useState(!isAuthDisabled)

  useEffect(() => {
    if (isAuthDisabled) {
      // Skip authentication in demo mode
      setIsAuthenticated(true)
      setIsLoading(false)
      return
    }

    const initializeMsal = async () => {
      try {
        // Initialize MSAL first
        await msalInstance?.initialize()

        // Handle redirect response after initialization
        const response = await msalInstance?.handleRedirectPromise()
        if (response?.account) {
          setUser(response.account)
          setIsAuthenticated(true)
        } else {
          // Check for existing accounts if no redirect response
          const accounts = msalInstance?.getAllAccounts() || []
          if (accounts.length > 0) {
            setUser(accounts[0])
            setIsAuthenticated(true)
          }
        }
      } catch (error) {
        console.error('MSAL initialization or redirect handling failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeMsal()
  }, [])

  const login = async () => {
    if (isAuthDisabled) {
      // No login needed in demo mode
      return
    }

    try {
      setIsLoading(true)
      const request: RedirectRequest = {
        ...loginRequest,
        prompt: 'select_account',
      }
      await msalInstance?.loginRedirect(request)
    } catch (error) {
      console.error('Login failed:', error)
      setIsLoading(false)
    }
  }

  const logout = async () => {
    if (isAuthDisabled) {
      // No logout needed in demo mode
      return
    }

    try {
      setIsLoading(true)
      await msalInstance?.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
      })
      setUser(null)
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Logout failed:', error)
      setIsLoading(false)
    }
  }

  const getAccessToken = async (): Promise<string | null> => {
    if (isAuthDisabled) {
      // Return demo token in demo mode
      return 'demo-token'
    }

    if (!msalInstance) {
      throw new Error('MSAL instance not available')
    }

    const account = msalInstance.getActiveAccount()
    if (!account) {
      throw new Error('No active account found')
    }
    const response: AuthenticationResult = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: account,
    })
    return response.accessToken
  }

  const value: AuthContextType = {
    isAuthenticated,
    user,
    login,
    logout,
    getAccessToken,
    isLoading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
