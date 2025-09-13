import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useApiClient } from '@/shared/utils'
import type { SettingsItem } from '../types'

interface UseSettingsDataResult {
  settings: SettingsItem[]
  isLoading: boolean
  refresh: () => Promise<void>
  createSetting: (data: Partial<SettingsItem>) => Promise<void>
  updateSetting: (id: string, data: Partial<SettingsItem>) => Promise<void>
  deleteSetting: (id: string) => Promise<void>
  toggleSettingActive: (id: string, isActive: boolean) => Promise<void>
  toggleSettingSecret: (id: string, isSecret: boolean) => Promise<void>
}

export function useSettingsData(shouldLoad = true): UseSettingsDataResult {
  const [settings, setSettings] = useState<SettingsItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const apiClient = useApiClient()

  const loadData = useCallback(async () => {
    if (!shouldLoad) return

    setIsLoading(true)
    try {
      // Only load settings data - master data is handled by separate hooks
      const settingsRes = await apiClient.get('/dm/settings')
      setSettings(settingsRes as SettingsItem[])
    } catch (error) {
      console.error('Error loading settings data:', error)
      toast.error('Failed to load settings data')
    } finally {
      setIsLoading(false)
    }
  }, [apiClient, shouldLoad])

  const createSetting = async (data: Partial<SettingsItem>) => {
    try {
      await apiClient.post('/dm/settings', data)
      toast.success('Setting created successfully')
      await loadData()
    } catch (error: unknown) {
      console.error('Error creating setting:', error)
      if (error instanceof Error && 'status' in error && (error as Error & { status?: number }).status === 400) {
        toast.error((error as Error & { message: string }).message || 'Validation error')
      } else {
        toast.error('Failed to create setting')
      }
      throw error
    }
  }

  const updateSetting = async (id: string, data: Partial<SettingsItem>) => {
    try {
      await apiClient.put(`/dm/settings/${id}`, data)
      toast.success('Setting updated successfully')
      await loadData()
    } catch (error: unknown) {
      console.error('Error updating setting:', error)
      if (error instanceof Error && 'status' in error && (error as Error & { status?: number }).status === 400) {
        toast.error((error as Error & { message: string }).message || 'Validation error')
      } else {
        toast.error('Failed to update setting')
      }
      throw error
    }
  }

  const deleteSetting = async (id: string) => {
    try {
      await apiClient.delete(`/dm/settings/${id}`)
      toast.success('Setting deleted successfully')
      await loadData()
    } catch (error) {
      console.error('Error deleting setting:', error)
      toast.error('Failed to delete setting')
      throw error
    }
  }

  const toggleSettingActive = async (id: string, isActive: boolean) => {
    try {
      await apiClient.put(`/dm/settings/${id}`, { is_active: isActive })
      toast.success(`Setting ${isActive ? 'activated' : 'deactivated'} successfully`)
      await loadData()
    } catch (error) {
      console.error('Error toggling setting active state:', error)
      toast.error('Failed to update setting')
      throw error
    }
  }

  const toggleSettingSecret = async (id: string, isSecret: boolean) => {
    try {
      await apiClient.put(`/dm/settings/${id}`, { is_secret: isSecret })
      toast.success(`Setting ${isSecret ? 'marked as secret' : 'unmarked as secret'} successfully`)
      await loadData()
    } catch (error) {
      console.error('Error toggling setting secret state:', error)
      toast.error('Failed to update setting')
      throw error
    }
  }

  useEffect(() => {
    if (shouldLoad) {
      loadData()
    }
  }, [loadData, shouldLoad])

  return {
    settings,
    isLoading,
    refresh: loadData,
    createSetting,
    updateSetting,
    deleteSetting,
    toggleSettingActive,
    toggleSettingSecret,
  }
}
