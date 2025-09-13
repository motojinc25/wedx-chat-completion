import { useCallback } from 'react'
import { useAuth } from '@/shared/contexts/auth-context'
import { apiClient } from '@/shared/utils'

interface SettingsResolveRequest {
  key: string
  audience_key?: string
  oid?: string
}

interface SettingsResolveResponse {
  key: string
  resolved_payload: unknown
  resolved_from: string
  specificity: number
  found: boolean
}

export function useSettingsResolver() {
  const { isAuthenticated, user } = useAuth()

  const parseJsonValue = useCallback((value: unknown): unknown => {
    if (typeof value === 'object' && value !== null) {
      return value
    }
    if (typeof value !== 'string') {
      throw new Error('Value is not a string')
    }
    try {
      return JSON.parse(value)
    } catch {
      throw new Error('Value is not valid JSON')
    }
  }, [])

  const resolveSetting = useCallback(
    async (key: string, audienceKey: string): Promise<SettingsResolveResponse> => {
      try {
        if (!isAuthenticated || !user) {
          throw new Error('User is not authenticated')
        }
        const oid = user.idTokenClaims?.oid || user.localAccountId
        const requestData: SettingsResolveRequest = {
          key,
          audience_key: audienceKey,
          oid: oid || undefined,
        }
        const response = await apiClient.post<SettingsResolveResponse>('/dm/settings/resolve', requestData)
        const parsedPayload = parseJsonValue(response.resolved_payload)

        return {
          ...response,
          resolved_payload: parsedPayload,
        }
      } catch (error) {
        throw new Error(`Failed to resolve setting: ${(error as Error).message}`)
      }
    },
    [isAuthenticated, user, parseJsonValue],
  )

  return { resolveSetting }
}
