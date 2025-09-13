import { PublicClientApplication } from '@azure/msal-browser'
import { apiScopes, loginRequest, msalConfig } from '@/config/auth-config'

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig)

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
  }

  private async getAuthToken(): Promise<string | null> {
    // Check if we're in demo mode
    const appMode = import.meta.env.VITE_APP_MODE
    if (appMode === 'demo') {
      return null // No authentication needed in demo mode
    }

    await msalInstance.initialize()
    const accounts = msalInstance.getAllAccounts()

    if (accounts.length === 0) {
      throw new Error('No authenticated account found')
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...apiScopes,
        account: accounts[0],
      })
      return response.accessToken
    } catch (error) {
      console.error('Silent token acquisition failed:', error)
      // Fallback to interactive token acquisition
      await msalInstance.acquireTokenRedirect(loginRequest)
      // After redirect, token acquisition should be handled in the redirect callback elsewhere.
      throw new Error('Redirecting for authentication. Token not available immediately.')
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const token = await this.getAuthToken()

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      }

      // Only add Authorization header if we have a token (not in demo mode)
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      })

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.detail) {
            errorMessage = errorData.detail
          }
        } catch {
          // If we can't parse the error response, use the default message
        }

        const error = new Error(errorMessage) as Error & { status?: number }
        error.status = response.status
        error.message = errorMessage
        throw error
      }

      // Handle empty responses (like DELETE operations)
      const text = await response.text()
      if (!text) {
        return {} as T
      }

      try {
        return JSON.parse(text)
      } catch {
        return text as T
      }
    } catch (error) {
      // Only log errors when not in test environment to avoid test output noise
      // Also skip logging for 400 validation errors (expected business logic constraints)
      const apiError = error as { status?: number; message?: string }
      const shouldLog =
        typeof (globalThis as Record<string, unknown>).vitest === 'undefined' &&
        !(apiError?.status === 400 && apiError?.message?.includes('Cannot delete'))

      if (shouldLog) {
        console.error('API request failed:', error)
      }
      throw error
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' })
  }

  async getToken(): Promise<string | null> {
    return this.getAuthToken()
  }
}

// Export a default instance
export const apiClient = new ApiClient()

// Hook for using the API client in React components
export const useApiClient = () => {
  return apiClient
}
