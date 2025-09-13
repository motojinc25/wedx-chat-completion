import { useCallback, useEffect, useState } from 'react'
import type { BaseDataItem } from '@/features/data-management/types'

type MasterTableItem = BaseDataItem

import { apiClient } from '@/shared/utils/api'

interface MasterTableHookResult<T extends MasterTableItem> {
  data: T[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  create: (item: Omit<T, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => Promise<T>
  update: (
    id: string,
    item: Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>,
  ) => Promise<T>
  remove: (id: string) => Promise<void>
}

export function useMasterTable<T extends MasterTableItem>(endpoint: string): MasterTableHookResult<T> {
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<T[]>(`/dm/${endpoint}`)
      setData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error(`Error fetching ${endpoint}:`, err)
    } finally {
      setIsLoading(false)
    }
  }, [endpoint])

  const create = async (
    item: Omit<T, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>,
  ): Promise<T> => {
    try {
      const newItem = await apiClient.post<T>(`/dm/${endpoint}`, item)
      setData((prev) => [...prev, newItem])
      return newItem
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create item'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const update = async (
    id: string,
    item: Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>,
  ): Promise<T> => {
    try {
      const updatedItem = await apiClient.put<T>(`/dm/${endpoint}/${id}`, item)
      setData((prev) => prev.map((existing) => (existing.id === id ? updatedItem : existing)))
      return updatedItem
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const remove = async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/dm/${endpoint}/${id}`)
      setData((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
    create,
    update,
    remove,
  }
}
