import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { AlertCircle, ChevronDown, ChevronRight, Clock, Eye, Filter, RefreshCw, Search } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { HistogramChart, type HistogramData } from '@/shared/components/ui/histogram-chart'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import type { MetricsFilters, ObservabilityMetric } from '../types'
import { observabilityApi } from '../utils/api'

const METRIC_TYPE_COLORS = {
  GAUGE: 'bg-blue-100 text-blue-800',
  SUM: 'bg-green-100 text-green-800',
  HISTOGRAM: 'bg-purple-100 text-purple-800',
  EXPONENTIAL_HISTOGRAM: 'bg-orange-100 text-orange-800',
  SUMMARY: 'bg-yellow-100 text-yellow-800',
  histogram: 'bg-purple-100 text-purple-800', // Default from backend
} as const

export function ObservabilityMetricsPage() {
  const [metrics, setMetrics] = useState<ObservabilityMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MetricsFilters>({ limit: 100 })
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      const response = await observabilityApi.getMetrics(filters)
      setMetrics(response.metrics)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch metrics:', err)
      setError('Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000)
      return () => clearInterval(interval)
    }
  }, [fetchMetrics, autoRefresh])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const handleFilterChange = (key: keyof MetricsFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value === '' ? undefined : value }))
  }

  const formatValue = useCallback((value: number, unit?: string): string => {
    let formattedValue: string

    if (Math.abs(value) >= 1e9) {
      formattedValue = `${(value / 1e9).toFixed(2)}B`
    } else if (Math.abs(value) >= 1e6) {
      formattedValue = `${(value / 1e6).toFixed(2)}M`
    } else if (Math.abs(value) >= 1e3) {
      formattedValue = `${(value / 1e3).toFixed(2)}K`
    } else if (Number.isInteger(value)) {
      formattedValue = value.toString()
    } else {
      formattedValue = value.toFixed(2)
    }

    return unit ? `${formattedValue} ${unit}` : formattedValue
  }, [])

  const toggleRowExpansion = useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rowId)) {
        newSet.delete(rowId)
      } else {
        newSet.add(rowId)
      }
      return newSet
    })
  }, [])

  // Aggregate histogram data from all metrics
  const getAggregatedHistogramData = (): HistogramData | null => {
    const histogramMetrics = metrics.filter(
      (metric) => metric.type === 'histogram' && metric.data && typeof metric.data === 'object',
    )

    if (histogramMetrics.length === 0) return null

    // Use the most recent metric's bounds/structure as base
    const baseMetric = histogramMetrics[0]
    const baseData = (baseMetric.data ?? baseMetric.raw_data) as unknown as Record<string, unknown>

    let aggregatedData: HistogramData = {
      sum: 0,
      count: 0,
    }

    // Handle bucketCounts and explicitBounds format
    if (Array.isArray(baseData.bucketCounts) && Array.isArray(baseData.explicitBounds)) {
      const bucketCounts = new Array(baseData.bucketCounts.length).fill(0)
      let totalSum = 0
      let totalCount = 0

      histogramMetrics.forEach((metric) => {
        const data = (metric.data ?? metric.raw_data) as unknown as Record<string, unknown>
        if (Array.isArray(data.bucketCounts)) {
          data.bucketCounts.forEach((count: unknown, index: number) => {
            if (index < bucketCounts.length) {
              bucketCounts[index] += Number(count || 0)
            }
          })
        }
        if (typeof data.sum === 'number') totalSum += data.sum
        if (typeof data.count === 'number') totalCount += data.count
      })

      aggregatedData = {
        bucketCounts,
        explicitBounds: baseData.explicitBounds as number[],
        sum: totalSum,
        count: totalCount,
      }
    } else if (Array.isArray(baseData.buckets)) {
      // Handle legacy buckets format
      const bucketMap = new Map<string, number>()
      let totalSum = 0
      let totalCount = 0

      histogramMetrics.forEach((metric) => {
        const data = (metric.data ?? metric.raw_data) as unknown as Record<string, unknown>
        if (Array.isArray(data.buckets)) {
          data.buckets.forEach((bucket: unknown) => {
            const bucketObj = bucket as Record<string, unknown>
            const le = String(bucketObj.le || '')
            const count = Number(bucketObj.count || 0)
            bucketMap.set(le, (bucketMap.get(le) || 0) + count)
          })
        }
        if (typeof data.sum === 'number') totalSum += data.sum
        if (typeof data.count === 'number') totalCount += data.count
      })

      const buckets = Array.from(bucketMap.entries()).map(([le, count]) => ({ le, count }))
      aggregatedData = {
        buckets,
        sum: totalSum,
        count: totalCount,
      }
    }

    return aggregatedData
  }

  const columns: ColumnDef<ObservabilityMetric>[] = useMemo(
    () => [
      {
        id: 'expander',
        header: '',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => toggleRowExpansion(row.original.id)} className="h-8 w-8 p-0">
            {expandedRows.has(row.original.id) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ),
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'name',
        header: 'Metric Name',
        cell: ({ getValue }) => (
          <div className="font-medium text-sm max-w-xs truncate" title={getValue() as string}>
            {getValue() as string}
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => {
          const type = getValue() as string
          return (
            <Badge
              className={METRIC_TYPE_COLORS[type as keyof typeof METRIC_TYPE_COLORS] || METRIC_TYPE_COLORS.histogram}>
              {type.toUpperCase()}
            </Badge>
          )
        },
        enableColumnFilter: true,
        filterFn: 'includesString',
      },
      {
        accessorKey: 'latest_value',
        header: 'Latest Value',
        cell: ({ row }) => (
          <div className="text-right font-mono">{formatValue(row.original.latest_value, row.original.unit)}</div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'latest_time',
        header: 'Last Updated',
        cell: ({ getValue }) => {
          const time = getValue() as string
          return time ? new Date(time).toLocaleString() : 'N/A'
        },
        enableSorting: true,
      },
      {
        accessorKey: 'scope_name',
        header: 'Scope',
        cell: ({ getValue }) => {
          const scope = getValue() as string | undefined
          return scope ? (
            <Badge variant="outline" className="text-xs">
              {scope}
            </Badge>
          ) : (
            <span className="text-gray-400">—</span>
          )
        },
        enableColumnFilter: true,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Eye className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Metric Details: {row.original.name}</DialogTitle>
                  <DialogDescription>Complete metric information and raw data</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                    {JSON.stringify(row.original, null, 2)}
                  </pre>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
      },
    ],
    [expandedRows, toggleRowExpansion, formatValue],
  )

  const table = useReactTable({
    data: metrics,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 text-green-700' : ''}>
            <Clock className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto-refresh (30s)
          </Button>
        </div>
        {/* Enhanced Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="global-search" className="text-sm font-medium mb-2 block">
                  Global Search
                </label>
                <div className="flex gap-2">
                  <Input
                    id="global-search"
                    placeholder="Search all columns..."
                    value={globalFilter ?? ''}
                    onChange={(e) => setGlobalFilter(String(e.target.value))}
                    className="flex-1"
                  />
                  <Button type="button" size="icon" variant="outline">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label htmlFor="metric-name-filter" className="text-sm font-medium mb-2 block">
                  Metric Name Filter
                </label>
                <Input
                  id="metric-name-filter"
                  placeholder="Filter by name..."
                  value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                  onChange={(e) => table.getColumn('name')?.setFilterValue(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="limit-select" className="text-sm font-medium mb-2 block">
                  Limit
                </label>
                <Select
                  value={filters.limit?.toString() || '100'}
                  onValueChange={(value) => handleFilterChange('limit', Number(value))}>
                  <SelectTrigger id="limit-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={fetchMetrics} disabled={loading} className="w-full">
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aggregated Histogram Chart */}
        {getAggregatedHistogramData() && (
          <HistogramChart
            data={getAggregatedHistogramData()}
            metricName="Aggregated Metrics"
            timestamp={new Date().toISOString()}
            className="mb-6"
          />
        )}

        {/* Main Data Table */}
        {error ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
                <Button onClick={fetchMetrics} className="mt-4">
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Metrics ({table.getFilteredRowModel().rows.length})</CardTitle>
              <CardDescription>
                Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={`metrics-skeleton-${Date.now()}-${i}`}
                      className="h-12 bg-gray-100 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <TableHead key={header.id} className="whitespace-nowrap">
                                {header.isPlaceholder ? null : (
                                  <div
                                    {...{
                                      className: header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                                      onClick: header.column.getToggleSortingHandler(),
                                    }}>
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                    {{
                                      asc: ' 🔼',
                                      desc: ' 🔽',
                                    }[header.column.getIsSorted() as string] ?? null}
                                  </div>
                                )}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {table.getRowModel().rows.map((row) => (
                          <React.Fragment key={row.id}>
                            <TableRow>
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                            {expandedRows.has(row.original.id) && (
                              <TableRow key={`${row.id}-expanded`}>
                                <TableCell colSpan={columns.length} className="bg-gray-50">
                                  <div className="p-4 space-y-4">
                                    {/* Attributes */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {Object.keys(row.original.attributes).length > 0 && (
                                        <div>
                                          <h4 className="font-medium mb-2">Attributes</h4>
                                          <div className="bg-blue-50 p-3 rounded text-sm">
                                            {Object.entries(row.original.attributes).map(([key, value]) => (
                                              <div key={key} className="flex justify-between py-1">
                                                <span className="text-blue-700">{key}:</span>
                                                <span className="font-mono text-blue-900">{String(value)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {Object.keys(row.original.resource_attributes).length > 0 && (
                                        <div>
                                          <h4 className="font-medium mb-2">Resource Attributes</h4>
                                          <div className="bg-green-50 p-3 rounded text-sm">
                                            {Object.entries(row.original.resource_attributes).map(([key, value]) => (
                                              <div key={key} className="flex justify-between py-1">
                                                <span className="text-green-700">{key}:</span>
                                                <span className="font-mono text-green-900">{String(value)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-2 py-4">
                    <div className="flex items-center space-x-6 lg:space-x-8">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Rows per page</p>
                        <Select
                          value={`${table.getState().pagination.pageSize}`}
                          onValueChange={(value) => table.setPageSize(Number(value))}>
                          <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={table.getState().pagination.pageSize} />
                          </SelectTrigger>
                          <SelectContent side="top">
                            {[10, 20, 30, 40, 50].map((pageSize) => (
                              <SelectItem key={pageSize} value={`${pageSize}`}>
                                {pageSize}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => table.setPageIndex(0)}
                          disabled={!table.getCanPreviousPage()}>
                          <span className="sr-only">Go to first page</span>
                          {'<<'}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => table.previousPage()}
                          disabled={!table.getCanPreviousPage()}>
                          <span className="sr-only">Go to previous page</span>
                          {'<'}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => table.nextPage()}
                          disabled={!table.getCanNextPage()}>
                          <span className="sr-only">Go to next page</span>
                          {'>'}
                        </Button>
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                          disabled={!table.getCanNextPage()}>
                          <span className="sr-only">Go to last page</span>
                          {'>>'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
