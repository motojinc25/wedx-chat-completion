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
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import type { LogsFilters, ObservabilityLog } from '../types'
import { observabilityApi } from '../utils/api'

const SEVERITY_LEVELS = {
  1: { name: 'TRACE', color: 'bg-gray-100 text-gray-800' },
  5: { name: 'DEBUG', color: 'bg-blue-100 text-blue-800' },
  9: { name: 'INFO', color: 'bg-green-100 text-green-800' },
  13: { name: 'WARN', color: 'bg-yellow-100 text-yellow-800' },
  17: { name: 'ERROR', color: 'bg-red-100 text-red-800' },
  21: { name: 'FATAL', color: 'bg-purple-100 text-purple-800' },
} as const

export function ObservabilityLogsPage() {
  const [logs, setLogs] = useState<ObservabilityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LogsFilters>({ limit: 100 })
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'time', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const response = await observabilityApi.getLogs(filters)
      setLogs(response.logs)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      setError('Failed to load logs')
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 30000)
      return () => clearInterval(interval)
    }
  }, [fetchLogs, autoRefresh])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleFilterChange = (key: keyof LogsFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value === '' ? undefined : value }))
  }

  const formatLogBody = useCallback((body: string | object | null): string => {
    if (typeof body === 'string') return body
    if (body && typeof body === 'object') {
      return JSON.stringify(body, null, 2)
    }
    return String(body || '')
  }, [])

  const getSeverityInfo = useCallback((severityNumber?: number, severityText?: string) => {
    if (severityNumber && SEVERITY_LEVELS[severityNumber as keyof typeof SEVERITY_LEVELS]) {
      return SEVERITY_LEVELS[severityNumber as keyof typeof SEVERITY_LEVELS]
    }
    if (severityText) {
      const level = Object.values(SEVERITY_LEVELS).find((l) => l.name === severityText.toUpperCase())
      if (level) return level
    }
    return { name: severityText?.toUpperCase() || 'UNKNOWN', color: 'bg-gray-100 text-gray-800' }
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

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const columns: ColumnDef<ObservabilityLog>[] = useMemo(
    () => [
      {
        id: 'expander',
        header: '',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => toggleRowExpansion(row.original.id)} className="h-6 w-6 p-0">
            {expandedRows.has(row.original.id) ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 40,
      },
      {
        accessorKey: 'time',
        header: 'Timestamp',
        cell: ({ getValue }) => {
          const time = getValue() as string
          return <div className="text-xs font-mono">{time ? new Date(time).toLocaleString() : 'N/A'}</div>
        },
        enableSorting: true,
        size: 160,
      },
      {
        accessorKey: 'severity_text',
        header: 'Level',
        cell: ({ row }) => {
          const severity = getSeverityInfo(row.original.severity_number, row.original.severity_text)
          return <Badge className={`${severity.color} text-xs px-1 py-0`}>{severity.name}</Badge>
        },
        enableColumnFilter: true,
        filterFn: 'includesString',
        size: 80,
      },
      {
        accessorKey: 'body',
        header: 'Message',
        cell: ({ getValue }) => {
          const body = formatLogBody(getValue() as string | object | null)
          return (
            <div className="text-xs max-w-md truncate" title={body}>
              {body}
            </div>
          )
        },
        enableSorting: false,
        size: 300,
      },
      {
        accessorKey: 'trace_id_hex',
        header: 'Trace ID',
        cell: ({ getValue }) => {
          const traceId = getValue() as string | undefined
          return traceId ? (
            <div className="text-xs font-mono bg-blue-50 px-1 rounded max-w-20 truncate" title={traceId}>
              {traceId}
            </div>
          ) : (
            <span className="text-gray-400 text-xs">—</span>
          )
        },
        enableColumnFilter: true,
        size: 100,
      },
      {
        accessorKey: 'span_id_hex',
        header: 'Span ID',
        cell: ({ getValue }) => {
          const spanId = getValue() as string | undefined
          return spanId ? (
            <div className="text-xs font-mono bg-green-50 px-1 rounded max-w-20 truncate" title={spanId}>
              {spanId}
            </div>
          ) : (
            <span className="text-gray-400 text-xs">—</span>
          )
        },
        enableColumnFilter: true,
        size: 100,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Eye className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Log Details</DialogTitle>
                  <DialogDescription>Complete log entry information</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(row.original, null, 2)}
                  </pre>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 60,
      },
    ],
    [expandedRows, toggleRowExpansion, formatLogBody, getSeverityInfo],
  )

  const table = useReactTable({
    data: logs,
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
        pageSize: 50,
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
                  value={(table.getColumn('trace_id_hex')?.getFilterValue() as string) ?? ''}
                  onChange={(e) => table.getColumn('trace_id_hex')?.setFilterValue(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div>
                <label htmlFor="severity-filter" className="text-sm font-medium mb-2 block">
                  Severity Level
                </label>
                <Select
                  value={filters.severity_min?.toString() || 'all'}
                  onValueChange={(value) =>
                    handleFilterChange('severity_min', value === 'all' ? undefined : Number(value))
                  }>
                  <SelectTrigger id="severity-filter" className="text-sm">
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="1">TRACE+</SelectItem>
                    <SelectItem value="5">DEBUG+</SelectItem>
                    <SelectItem value="9">INFO+</SelectItem>
                    <SelectItem value="13">WARN+</SelectItem>
                    <SelectItem value="17">ERROR+</SelectItem>
                    <SelectItem value="21">FATAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="limit-select" className="text-sm font-medium mb-2 block">
                  Limit
                </label>
                <Select
                  value={filters.limit?.toString() || '100'}
                  onValueChange={(value) => handleFilterChange('limit', Number(value))}>
                  <SelectTrigger id="limit-select" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-end mt-4">
              <Button onClick={fetchLogs} disabled={loading} className="w-full">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Data Table */}
        {error ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
                <Button onClick={fetchLogs} className="mt-4">
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Logs ({table.getFilteredRowModel().rows.length})</CardTitle>
              <CardDescription>
                Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} log entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 20 }, (_, i) => (
                    <div key={`logs-skeleton-${Date.now()}-${i}`} className="h-8 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id} className="h-10">
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
                          <React.Fragment key={row.id}>
                            <TableRow className="h-8 hover:bg-gray-50">
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} className="p-2 text-xs">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                            {expandedRows.has(row.original.id) && (
                              <TableRow key={`${row.id}-expanded`}>
                                <TableCell colSpan={columns.length} className="bg-gray-50 p-4">
                                  <div className="space-y-4">
                                    {/* Detailed Information */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      <div>
                                        <h4 className="font-medium mb-2 text-sm">Basic Info</h4>
                                        <div className="bg-blue-50 p-3 rounded text-xs space-y-1">
                                          <div className="flex justify-between">
                                            <span className="text-blue-700">Event:</span>
                                            <span className="font-mono text-blue-900">
                                              {formatValue(row.original.event_name)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-blue-700">Observed:</span>
                                            <span className="font-mono text-blue-900">
                                              {row.original.observed_time
                                                ? new Date(row.original.observed_time).toLocaleString()
                                                : '—'}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-blue-700">Flags:</span>
                                            <span className="font-mono text-blue-900">
                                              {formatValue(row.original.trace_flags)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {Object.keys(row.original.attributes).length > 0 && (
                                        <div>
                                          <h4 className="font-medium mb-2 text-sm">Attributes</h4>
                                          <div className="bg-green-50 p-3 rounded text-xs max-h-32 overflow-y-auto">
                                            {Object.entries(row.original.attributes).map(([key, value]) => (
                                              <div key={key} className="flex justify-between py-1">
                                                <span className="text-green-700 break-all">{key}:</span>
                                                <span className="font-mono text-green-900 break-all ml-2">
                                                  {formatValue(value)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {Object.keys(row.original.resource_attributes).length > 0 && (
                                        <div>
                                          <h4 className="font-medium mb-2 text-sm">Resource Attributes</h4>
                                          <div className="bg-purple-50 p-3 rounded text-xs max-h-32 overflow-y-auto">
                                            {Object.entries(row.original.resource_attributes).map(([key, value]) => (
                                              <div key={key} className="flex justify-between py-1">
                                                <span className="text-purple-700 break-all">{key}:</span>
                                                <span className="font-mono text-purple-900 break-all ml-2">
                                                  {formatValue(value)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Full Message Body */}
                                    <div>
                                      <h4 className="font-medium mb-2 text-sm">Full Message</h4>
                                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                                        {formatLogBody(row.original.body)}
                                      </pre>
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
                            {[20, 50, 100, 200].map((pageSize) => (
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
