import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/mocks/server'
import { ApiClient } from './api'

// Mock MSAL
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllAccounts: vi.fn().mockReturnValue([{ username: 'test@example.com' }]),
    acquireTokenSilent: vi.fn().mockResolvedValue({
      accessToken: 'mock-token',
    }),
    acquireTokenRedirect: vi.fn(),
  })),
}))

// Mock auth config
vi.mock('../config/auth-config', () => ({
  apiScopes: { scopes: ['api://test'] },
  loginRequest: { scopes: ['api://test'] },
  msalConfig: {
    auth: {
      clientId: 'test-client-id',
      authority: 'https://login.microsoftonline.com/test-tenant',
    },
  },
}))

describe('ApiClient', () => {
  let apiClient: ApiClient

  beforeEach(() => {
    apiClient = new ApiClient('/api')
    vi.clearAllMocks()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { data: 'test' }

      // Add specific handler for this test
      server.use(
        http.get('/api/test', () => {
          return HttpResponse.json(mockResponse)
        }),
      )

      const result = await apiClient.get('/test')
      expect(result).toEqual(mockResponse)
    })

    it('should throw error on failed GET request', async () => {
      // Add specific handler for this test that returns error
      server.use(
        http.get('/api/test', () => {
          return HttpResponse.json({ error: 'Not Found' }, { status: 404, statusText: 'Not Found' })
        }),
      )

      await expect(apiClient.get('/test')).rejects.toThrow('API request failed: 404 Not Found')
    })
  })

  describe('POST requests', () => {
    it('should make successful POST request with data', async () => {
      const mockResponse = { id: 1 }
      const postData = { name: 'test' }

      server.use(
        http.post('/api/test', () => {
          return HttpResponse.json(mockResponse)
        }),
      )

      const result = await apiClient.post('/test', postData)
      expect(result).toEqual(mockResponse)
    })

    it('should make POST request without data', async () => {
      const mockResponse = { success: true }

      server.use(
        http.post('/api/test', () => {
          return HttpResponse.json(mockResponse)
        }),
      )

      const result = await apiClient.post('/test')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('PUT requests', () => {
    it('should make successful PUT request', async () => {
      const mockResponse = { updated: true }
      const putData = { name: 'updated' }

      server.use(
        http.put('/api/test/1', () => {
          return HttpResponse.json(mockResponse)
        }),
      )

      const result = await apiClient.put('/test/1', putData)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('DELETE requests', () => {
    it('should make successful DELETE request', async () => {
      const mockResponse = { deleted: true }

      server.use(
        http.delete('/api/test/1', () => {
          return HttpResponse.json(mockResponse)
        }),
      )

      const result = await apiClient.delete('/test/1')
      expect(result).toEqual(mockResponse)
    })
  })
})
