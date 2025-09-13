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
import { Activity, AlertCircle, Clock, Filter, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { SpanTimeline } from '@/shared/components/ui/span-timeline'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import type { ObservabilityLog, ObservabilityTrace, TracesFilters } from '../types'
import { observabilityApi } from '../utils/api'

interface TraceGroup {
  traceId: string
  spans: ObservabilityTrace[]
  rootSpan: ObservabilityTrace
  spanCount: number
  totalDuration: number
  errorCount: number
  startTime: string
  endTime: string
}

const SPAN_KIND_COLORS = {
  INTERNAL: 'bg-gray-100 text-gray-800',
  SERVER: 'bg-blue-100 text-blue-800',
  CLIENT: 'bg-green-100 text-green-800',
  PRODUCER: 'bg-purple-100 text-purple-800',
  CONSUMER: 'bg-orange-100 text-orange-800',
} as const

const STATUS_COLORS = {
  UNSET: 'bg-gray-100 text-gray-800',
  OK: 'bg-green-100 text-green-800',
  ERROR: 'bg-red-100 text-red-800',
} as const

export function ObservabilityTracesPage() {
  const [traces, setTraces] = useState<ObservabilityTrace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TracesFilters>({ limit: 100 })
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [selectedSpan, setSelectedSpan] = useState<ObservabilityTrace | null>(null)
  const [relatedLogs, setRelatedLogs] = useState<ObservabilityLog[]>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'startTime', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')

  const fetchTraces = useCallback(async () => {
    try {
      setLoading(true)
      const response = await observabilityApi.getTraces(filters)
      setTraces(response.traces)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch traces:', err)
      setError('Failed to load traces')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchRelatedLogs = useCallback(async (traceId: string) => {
    try {
      const response = await observabilityApi.getLogsForTrace(traceId)
      setRelatedLogs(response.logs)
    } catch (err) {
      console.error('Failed to fetch related logs:', err)
      setRelatedLogs([])
    }
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchTraces, 30000)
      return () => clearInterval(interval)
    }
  }, [fetchTraces, autoRefresh])

  useEffect(() => {
    fetchTraces()
  }, [fetchTraces])

  // Fetch related logs when span is selected
  useEffect(() => {
    if (selectedSpan?.trace_id_hex) {
      fetchRelatedLogs(selectedSpan.trace_id_hex)
    }
  }, [selectedSpan, fetchRelatedLogs])

  const handleFilterChange = (key: keyof TracesFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value === '' ? undefined : value }))
  }

  const formatDuration = useCallback((durationMs: number) => {
    if (durationMs < 1) {
      return `${(durationMs * 1000).toFixed(0)}μs`
    }
    if (durationMs < 1000) {
      return `${durationMs.toFixed(1)}ms`
    }
    return `${(durationMs / 1000).toFixed(2)}s`
  }, [])

  const getDurationColor = useCallback((durationMs: number) => {
    if (durationMs < 100) return 'text-green-600'
    if (durationMs < 1000) return 'text-yellow-600'
    return 'text-red-600'
  }, [])

  // Group traces by trace ID
  const groupedTraces: TraceGroup[] = useMemo(() => {
    const grouped = new Map<string, ObservabilityTrace[]>()

    traces.forEach((trace) => {
      const traceId = trace.trace_id_hex
      if (!grouped.has(traceId)) {
        grouped.set(traceId, [])
      }
      grouped.get(traceId)?.push(trace)
    })

    return Array.from(grouped.entries()).map(([traceId, spans]) => {
      const rootSpan = spans.find((s) => !s.parent_span_id_hex) || spans[0]
      const errorCount = spans.filter((s) => s.status_code === 'ERROR').length
      const startTimes = spans.map((s) => new Date(s.start_time).getTime())
      const endTimes = spans.map((s) => new Date(s.end_time).getTime())
      const totalDuration = Math.max(...spans.map((s) => s.duration_ms))

      return {
        traceId,
        spans,
        rootSpan,
        spanCount: spans.length,
        errorCount,
        totalDuration,
        startTime: new Date(Math.min(...startTimes)).toISOString(),
        endTime: new Date(Math.max(...endTimes)).toISOString(),
      }
    })
  }, [traces])

  const handleTraceSelect = useCallback((traceGroup: TraceGroup) => {
    setSelectedTraceId(traceGroup.traceId)
  }, [])

  const handleSpanClick = (span: ObservabilityTrace) => {
    setSelectedSpan(span)
  }

  const formatValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }, [])

  const columns: ColumnDef<TraceGroup>[] = useMemo(
    () => [
      {
        accessorKey: 'traceId',
        header: 'Trace ID',
        cell: ({ getValue, row }) => {
          const traceId = getValue() as string
          const isSelected = selectedTraceId === traceId
          return (
            <button
              type="button"
              onClick={() => handleTraceSelect(row.original)}
              className={`text-xs font-mono px-2 py-1 rounded max-w-20 truncate text-left hover:bg-blue-100 ${
                isSelected ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-gray-50'
              }`}
              title={traceId}>
              {traceId.substring(0, 8)}...
            </button>
          )
        },
        enableSorting: false,
        size: 100,
      },
      {
        accessorKey: 'rootSpan.name',
        header: 'Root Span',
        cell: ({ row }) => (
          <div className="text-xs font-medium truncate max-w-48" title={row.original.rootSpan.name}>
            {row.original.rootSpan.name}
          </div>
        ),
        enableSorting: true,
        size: 200,
      },
      {
        accessorKey: 'startTime',
        header: 'Start Time',
        cell: ({ getValue }) => {
          const time = getValue() as string
          return <div className="text-xs font-mono">{time ? new Date(time).toLocaleString() : 'N/A'}</div>
        },
        enableSorting: true,
        size: 160,
      },
      {
        accessorKey: 'totalDuration',
        header: 'Duration',
        cell: ({ getValue }) => {
          const duration = getValue() as number
          return <div className={`text-xs font-mono ${getDurationColor(duration)}`}>{formatDuration(duration)}</div>
        },
        enableSorting: true,
        size: 100,
      },
      {
        accessorKey: 'spanCount',
        header: 'Spans',
        cell: ({ getValue }) => <div className="text-xs font-medium text-center">{getValue() as number}</div>,
        enableSorting: true,
        size: 80,
      },
      {
        accessorKey: 'errorCount',
        header: 'Errors',
        cell: ({ getValue }) => {
          const errors = getValue() as number
          return errors > 0 ? (
            <Badge className="bg-red-100 text-red-800 text-xs px-1 py-0">{errors}</Badge>
          ) : (
            <span className="text-xs text-gray-400">0</span>
          )
        },
        enableSorting: true,
        size: 80,
      },
      {
        accessorKey: 'rootSpan.status_code',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.rootSpan.status_code
          return (
            <Badge
              className={`${STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.UNSET} text-xs px-1 py-0`}>
              {status}
            </Badge>
          )
        },
        enableColumnFilter: true,
        filterFn: 'includesString',
        size: 80,
      },
    ],
    [selectedTraceId, handleTraceSelect, formatDuration, getDurationColor],
  )

  const table = useReactTable({
    data: groupedTraces,
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
      <div className="p-4 space-y-4">
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

        <div className="h-full flex gap-4">
          {/* Left Pane - Trace List */}
          <div className="w-1/2 flex flex-col">
            {/* Filters */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
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
                        placeholder="Search traces..."
                        value={globalFilter ?? ''}
                        onChange={(e) => setGlobalFilter(String(e.target.value))}
                        className="flex-1 text-sm"
                      />
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8">
                        <Search className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="trace-id-filter" className="text-sm font-medium mb-2 block">
                      Trace ID
                    </label>
                    <Input
                      id="trace-id-filter"
                      placeholder="Filter by trace ID..."
                      value={filters.trace_id || ''}
                      onChange={(e) => handleFilterChange('trace_id', e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="status-filter" className="text-sm font-medium mb-2 block">
                      Status
                    </label>
                    <Select
                      value={filters.status_code || 'all'}
                      onValueChange={(value) => handleFilterChange('status_code', value === 'all' ? undefined : value)}>
                      <SelectTrigger id="status-filter" className="text-sm">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="OK">OK</SelectItem>
                        <SelectItem value="ERROR">ERROR</SelectItem>
                        <SelectItem value="UNSET">UNSET</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label htmlFor="min-duration-filter" className="text-sm font-medium mb-2 block">
                      Min Duration (ms)
                    </label>
                    <Input
                      id="min-duration-filter"
                      type="number"
                      placeholder="e.g. 100"
                      value={filters.min_duration_ms || ''}
                      onChange={(e) =>
                        handleFilterChange('min_duration_ms', e.target.value ? Number(e.target.value) : undefined)
                      }
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-end mt-4">
                  <Button onClick={fetchTraces} disabled={loading} className="w-full">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Traces
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Trace Table */}
            <Card className="flex-1 overflow-hidden">
              <CardHeader>
                <CardTitle>Traces ({table.getFilteredRowModel().rows.length})</CardTitle>
                <CardDescription>Select a trace to view its span timeline</CardDescription>
              </CardHeader>
              <CardContent className="h-full overflow-hidden">
                {error ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600">{error}</p>
                    <Button onClick={fetchTraces} className="mt-4">
                      Retry
                    </Button>
                  </div>
                ) : loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={`traces-skeleton-${Date.now()}-${i}`}
                        className="h-8 bg-gray-100 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="flex-1 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="h-8">
                              {headerGroup.headers.map((header) => (
                                <TableHead
                                  key={header.id}
                                  className="whitespace-nowrap text-xs p-2"
                                  style={{ width: header.getSize() }}>
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
                            <TableRow key={row.id} className="h-8 hover:bg-gray-50">
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} className="p-2 text-xs">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
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
                              {[10, 20, 50, 100].map((pageSize) => (
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
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Pane - Span Timeline */}
          <div className="w-1/2 flex flex-col">
            <SpanTimeline traces={traces} selectedTraceId={selectedTraceId} onSpanClick={handleSpanClick} />
          </div>
        </div>
      </div>

      {/* Span Detail Modal */}
      {selectedSpan && (
        <Dialog open={!!selectedSpan} onOpenChange={() => setSelectedSpan(null)}>
          <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Span Details: {selectedSpan?.name || 'Unknown'}
              </DialogTitle>
              <DialogDescription>Complete span information and related logs</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 text-sm">Basic Information</h4>
                  <div className="bg-blue-50 p-3 rounded text-xs space-y-2">
                    <div>
                      <span className="text-blue-700 block mb-1">Name:</span>
                      <span className="font-mono text-blue-900 break-words">{selectedSpan?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 block mb-1">Trace ID:</span>
                      <span className="font-mono text-blue-900 break-all text-xs">
                        {selectedSpan?.trace_id_hex || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700 block mb-1">Span ID:</span>
                      <span className="font-mono text-blue-900 break-all text-xs">
                        {selectedSpan?.span_id_hex || 'N/A'}
                      </span>
                    </div>
                    {selectedSpan?.parent_span_id_hex && (
                      <div>
                        <span className="text-blue-700 block mb-1">Parent ID:</span>
                        <span className="font-mono text-blue-900 break-all text-xs">
                          {selectedSpan.parent_span_id_hex}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 text-sm">Timing & Status</h4>
                  <div className="bg-green-50 p-3 rounded text-xs space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-green-700">Duration:</span>
                      <span className={`font-mono ${getDurationColor(selectedSpan?.duration_ms || 0)}`}>
                        {formatDuration(selectedSpan?.duration_ms || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-700 block mb-1">Started:</span>
                      <span className="font-mono text-green-900 break-words text-xs">
                        {selectedSpan?.start_time ? new Date(selectedSpan.start_time).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Status:</span>
                      <Badge
                        className={`${STATUS_COLORS[(selectedSpan?.status_code as keyof typeof STATUS_COLORS) || 'UNSET'] || STATUS_COLORS.UNSET} text-xs`}>
                        {selectedSpan?.status_code || 'UNSET'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Kind:</span>
                      <Badge
                        className={`${SPAN_KIND_COLORS[(selectedSpan?.kind as keyof typeof SPAN_KIND_COLORS) || 'INTERNAL'] || SPAN_KIND_COLORS.INTERNAL} text-xs`}>
                        {selectedSpan?.kind || 'INTERNAL'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attributes */}
              {selectedSpan && Object.keys(selectedSpan.attributes || {}).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-sm">Span Attributes</h4>
                  <div className="bg-purple-50 p-3 rounded text-xs max-h-32 overflow-y-auto">
                    {Object.entries(selectedSpan.attributes || {}).map(([key, value]) => (
                      <div key={key} className="py-2 border-b border-purple-100 last:border-b-0">
                        <div className="text-purple-700 break-words font-medium mb-1">{key}:</div>
                        <div className="font-mono text-purple-900 break-words overflow-wrap-anywhere pl-2">
                          {formatValue(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Logs */}
              {relatedLogs.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-sm">Related Logs ({relatedLogs.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {relatedLogs.map((log) => (
                      <div key={log.id} className="bg-orange-50 p-3 rounded text-xs">
                        <div className="flex items-start gap-2 mb-2 flex-wrap">
                          <Badge className="text-xs px-1 py-0 flex-shrink-0">{log.severity_text || 'UNKNOWN'}</Badge>
                          <span className="font-mono text-orange-900 break-words text-xs">
                            {new Date(log.time).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-orange-800 break-words overflow-wrap-anywhere">
                          {typeof log.body === 'string' ? log.body : JSON.stringify(log.body)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full JSON View */}
              <div>
                <h4 className="font-medium mb-2 text-sm">Complete Span Data</h4>
                <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-60 whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedSpan || {}, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
