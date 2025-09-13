import { Activity, Brain, Clock, RefreshCw, Server, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Switch } from '@/shared/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useSettingsResolver } from '@/shared/hooks'
import { useApiClient } from '@/shared/utils'
import type { KernelInfo, KernelMetrics, TenantStats } from '../types'

export function DashboardKernel() {
  const [metrics, setMetrics] = useState<KernelMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false) // Default OFF as requested
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null) // null until resolved
  const apiClient = useApiClient()
  const { resolveSetting } = useSettingsResolver()

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      const response = await apiClient.get<KernelMetrics>('/dashboard/kernel/metrics')
      setMetrics(response)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch kernel metrics:', err)
      setError('Failed to load kernel metrics')
    } finally {
      setLoading(false)
    }
  }, [apiClient])

  // Resolve refresh interval setting on mount
  useEffect(() => {
    const loadRefreshInterval = async () => {
      try {
        const setting = await resolveSetting('ui.page.dashboard.refresh.interval_sec', 'react_admin')
        const intervalMs =
          typeof (setting.resolved_payload as { value?: number })?.value === 'number'
            ? (setting.resolved_payload as { value: number }).value * 1000
            : 30000
        setRefreshInterval(intervalMs)
      } catch (error) {
        console.error('Failed to resolve refresh interval setting:', error)
        setRefreshInterval(30000) // Keep default 30 seconds
      }
    }

    loadRefreshInterval()
  }, [resolveSetting])

  // Initial load
  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  // Auto-refresh using resolved interval when enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval !== null) {
      const interval = setInterval(fetchMetrics, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchMetrics, autoRefresh, refreshInterval])

  if (loading) {
    return <KernelMetricsLoading />
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-center text-red-500">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground">
          <p>No kernel metrics available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            {lastUpdated && <span className="ml-2 text-xs">• Last updated: {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2">
            <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <label htmlFor="auto-refresh" className="text-sm font-medium">
              Auto-refresh ({refreshInterval !== null ? `${Math.round(refreshInterval / 1000)}` : '-'}s)
            </label>
          </div>
          {/* Manual refresh button */}
          <Button onClick={fetchMetrics} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Kernels"
          value={metrics.total_kernels}
          icon={Server}
          description="All kernels in system"
        />
        <MetricCard
          title="Active Kernels"
          value={metrics.active_kernels.length}
          icon={Activity}
          description="Currently running"
        />
        <MetricCard
          title="Tenants"
          value={Object.keys(metrics.tenant_stats).length}
          icon={Users}
          description="Organizations using kernels"
        />
        <MetricCard
          title="Max Idle Time"
          value={`${Math.round(metrics.max_idle_time_seconds / 60)}m`}
          icon={Clock}
          description="Before auto-cleanup"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ActiveKernelsTable kernels={metrics.active_kernels} />
        <TenantStatsTable tenantStats={metrics.tenant_stats} />
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  )
}

function ActiveKernelsTable({ kernels }: { kernels: KernelInfo[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Active Kernels
        </CardTitle>
        <CardDescription>Currently running kernel instances</CardDescription>
      </CardHeader>
      <CardContent>
        {kernels.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No active kernels</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Access Count</TableHead>
                  <TableHead>Last Accessed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kernels.map((kernel) => (
                  <TableRow key={kernel.id}>
                    <TableCell className="font-mono text-xs">{kernel.user_id.substring(0, 8)}...</TableCell>
                    <TableCell className="font-mono text-xs">{kernel.tenant_id.substring(0, 8)}...</TableCell>
                    <TableCell>{formatDuration(kernel.uptime_seconds)}</TableCell>
                    <TableCell>{kernel.access_count}</TableCell>
                    <TableCell>{new Date(kernel.last_accessed).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TenantStatsTable({ tenantStats }: { tenantStats: Record<string, TenantStats> }) {
  const tenants = Object.entries(tenantStats)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Tenant Statistics
        </CardTitle>
        <CardDescription>Kernel usage by tenant</CardDescription>
      </CardHeader>
      <CardContent>
        {tenants.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No tenant data</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Kernels</TableHead>
                  <TableHead>Total Access</TableHead>
                  <TableHead>Avg Uptime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map(([tenantId, stats]) => (
                  <TableRow key={tenantId}>
                    <TableCell className="font-mono text-xs">{tenantId.substring(0, 8)}...</TableCell>
                    <TableCell>{stats.count}</TableCell>
                    <TableCell>{stats.total_access_count}</TableCell>
                    <TableCell>{formatDuration(stats.avg_uptime_seconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function KernelMetricsLoading() {
  return (
    <div className="space-y-6 p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map(() => (
          <Card key={crypto.randomUUID()}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map(() => (
                <Skeleton key={crypto.randomUUID()} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map(() => (
                <Skeleton key={crypto.randomUUID()} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${remainingSeconds}s`
}
