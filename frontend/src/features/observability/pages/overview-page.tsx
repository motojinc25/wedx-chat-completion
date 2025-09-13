import { Activity, AlertTriangle, BarChart3, Database, FileText, RefreshCw, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import type { ObservabilityOverview } from '../types'
import { observabilityApi } from '../utils/api'

export function ObservabilityOverviewPage() {
  const [overview, setOverview] = useState<ObservabilityOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false) // Default OFF as requested
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true)
      const response = await observabilityApi.getOverview()
      setOverview(response.overview)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch overview:', err)
      setError('Failed to load observability data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchOverview, 30000)
      return () => clearInterval(interval)
    }
  }, [fetchOverview, autoRefresh])

  if (loading) {
    return (
      <div className="h-full p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton loading items
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6">
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
              <Switch id="auto-refresh-overview" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <label htmlFor="auto-refresh-overview" className="text-sm font-medium">
                Auto-refresh (30s)
              </label>
            </div>
            {/* Manual refresh button */}
            <Button onClick={fetchOverview} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        {error ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-red-600">{error}</div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Total Statistics */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview?.total_logs?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground">All time log entries</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Traces</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview?.total_spans?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground">All time span entries</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overview?.total_metrics?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground">Metric streams defined</p>
                </CardContent>
              </Card>

              {/* Health Indicators */}
              <Card
                className={
                  overview?.recent_errors_24h
                    ? overview.recent_errors_24h.length > 0
                      ? 'border-red-200'
                      : 'border-green-200'
                    : ''
                }>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Errors (24h)</CardTitle>
                  <AlertTriangle
                    className={`h-4 w-4 ${overview?.recent_errors_24h && overview.recent_errors_24h.length > 0 ? 'text-red-500' : 'text-green-500'}`}
                  />
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${overview?.recent_errors_24h && overview.recent_errors_24h.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {overview?.recent_errors_24h?.length ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Error-level log entries</p>
                </CardContent>
              </Card>

              <Card
                className={
                  overview?.slow_spans_24h
                    ? overview.slow_spans_24h.length > 0
                      ? 'border-yellow-200'
                      : 'border-green-200'
                    : ''
                }>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Slow Spans (24h)</CardTitle>
                  <Database
                    className={`h-4 w-4 ${overview?.slow_spans_24h && overview.slow_spans_24h.length > 0 ? 'text-yellow-500' : 'text-green-500'}`}
                  />
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${overview?.slow_spans_24h && overview.slow_spans_24h.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {overview?.slow_spans_24h?.length ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Spans &gt;1s duration</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                  <Activity className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">Operational</div>
                  <p className="text-xs text-muted-foreground">All systems running</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logs</CardTitle>
                  <CardDescription>
                    View and search through application logs with filtering capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to="/observability/logs">View Logs</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Traces</CardTitle>
                  <CardDescription>Analyze distributed traces and performance bottlenecks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to="/observability/traces">View Traces</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Metrics</CardTitle>
                  <CardDescription>Monitor system metrics and key performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to="/observability/metrics">View Metrics</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
