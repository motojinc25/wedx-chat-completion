// Kernel feature types

export interface KernelInfo {
  id: string
  user_id: string
  tenant_id: string
  created_at: string
  last_accessed: string
  access_count: number
  is_active: boolean
  uptime_seconds: number
}

export interface TenantStats {
  count: number
  total_access_count: number
  avg_uptime_seconds: number
}

export interface KernelMetrics {
  total_kernels: number
  active_kernels: KernelInfo[]
  tenant_stats: Record<string, TenantStats>
  max_idle_time_seconds: number
  cleanup_interval_seconds?: number
}

export interface KernelTabConfig {
  id: string
  title: string
  description?: string
}
