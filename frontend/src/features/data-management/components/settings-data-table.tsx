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
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowUpDown,
  ChevronDown,
  Code2,
  Edit,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { JsonEditor } from '@/shared/components'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Progress,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui'
import type { SettingsItem } from '../types'

export type SetupProgressCallback = (current: number, total: number, currentItem: string) => void

interface SettingsDataTableProps {
  data: SettingsItem[]
  isLoading: boolean
  onRefresh: () => void
  onAdd: () => void
  onEdit: (item: SettingsItem) => void
  onDelete: (item: SettingsItem) => void
  onToggleActive: (item: SettingsItem) => void
  onToggleSecret: (item: SettingsItem) => void
  onPayloadEdit: (item: SettingsItem, newPayload: unknown) => Promise<void>
  onInitialSetup: (
    onProgress?: SetupProgressCallback,
  ) => Promise<{ skipped: number; success: number; errors: string[] }>
}

export function SettingsDataTable({
  data,
  isLoading,
  onRefresh,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleSecret,
  onPayloadEdit,
  onInitialSetup,
}: SettingsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [jsonEditor, setJsonEditor] = useState<{ open: boolean; item: SettingsItem | null }>({
    open: false,
    item: null,
  })
  const [deleteItem, setDeleteItem] = useState<SettingsItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [updatingSecrets, setUpdatingSecrets] = useState<Set<string>>(new Set())
  const [updatingActives, setUpdatingActives] = useState<Set<string>>(new Set())
  const [optimisticStates, setOptimisticStates] = useState<Record<string, Partial<SettingsItem>>>({})
  const [showInitialSetup, setShowInitialSetup] = useState(false)
  const [isInitialSetup, setIsInitialSetup] = useState(false)
  const [setupResult, setSetupResult] = useState<{ skipped: number; success: number; errors: string[] } | null>(null)
  const [setupProgress, setSetupProgress] = useState({ current: 0, total: 0, currentItem: '' })

  const handleJsonEdit = (item: SettingsItem) => {
    setJsonEditor({ open: true, item })
  }

  const handleJsonSave = async (newPayload: unknown) => {
    if (jsonEditor.item) {
      await onPayloadEdit(jsonEditor.item, newPayload)
      setJsonEditor({ open: false, item: null })
    }
  }

  const handleDeleteClick = (item: SettingsItem) => {
    setDeleteItem(item)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return

    setIsDeleting(true)
    try {
      await onDelete(deleteItem)
      setDeleteItem(null)
    } catch (error) {
      console.error('Failed to delete setting:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    if (!isDeleting) {
      setDeleteItem(null)
    }
  }

  const handleInitialSetup = () => {
    setSetupResult(null)
    setSetupProgress({ current: 0, total: 0, currentItem: '' })
    setShowInitialSetup(true)
  }

  const handleInitialSetupConfirm = async () => {
    setIsInitialSetup(true)
    setSetupProgress({ current: 0, total: 0, currentItem: '' })

    try {
      const result = await onInitialSetup((current, total, currentItem) => {
        setSetupProgress({ current, total, currentItem })
      })
      setSetupResult(result)
    } catch (error) {
      console.error('Failed to run initial setup:', error)
      setSetupResult({
        skipped: 0,
        success: 0,
        errors: ['Failed to run initial setup. Please try again.'],
      })
    } finally {
      setIsInitialSetup(false)
    }
  }

  const handleInitialSetupClose = () => {
    if (!isInitialSetup) {
      setShowInitialSetup(false)
      setSetupResult(null)
    }
  }

  const getItemWithOptimisticState = (item: SettingsItem) => {
    const optimisticUpdate = optimisticStates[item.id]
    return optimisticUpdate ? { ...item, ...optimisticUpdate } : item
  }

  const handleToggleSecret = async (item: SettingsItem) => {
    const itemId = item.id
    const newSecretState = !item.is_secret

    // Optimistically update UI first
    setOptimisticStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], is_secret: newSecretState },
    }))
    setUpdatingSecrets((prev) => new Set(prev).add(itemId))

    try {
      await onToggleSecret(item)
      // Clear optimistic state after successful update
      setOptimisticStates((prev) => {
        const newStates = { ...prev }
        delete newStates[itemId]
        return newStates
      })
    } catch (error) {
      console.error('Failed to toggle secret:', error)
      // Revert optimistic update on error
      setOptimisticStates((prev) => {
        const newStates = { ...prev }
        delete newStates[itemId]
        return newStates
      })
    } finally {
      setUpdatingSecrets((prev) => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  const handleToggleActive = async (item: SettingsItem) => {
    const itemId = item.id
    const newActiveState = !item.is_active

    // Optimistically update UI first
    setOptimisticStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], is_active: newActiveState },
    }))
    setUpdatingActives((prev) => new Set(prev).add(itemId))

    try {
      await onToggleActive(item)
      // Clear optimistic state after successful update
      setOptimisticStates((prev) => {
        const newStates = { ...prev }
        delete newStates[itemId]
        return newStates
      })
    } catch (error) {
      console.error('Failed to toggle active:', error)
      // Revert optimistic update on error
      setOptimisticStates((prev) => {
        const newStates = { ...prev }
        delete newStates[itemId]
        return newStates
      })
    } finally {
      setUpdatingActives((prev) => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  const columns: ColumnDef<SettingsItem>[] = [
    {
      accessorKey: 'key',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Key
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const key = row.getValue('key') as string
        return (
          <div className="font-mono text-sm max-w-[200px] truncate" title={key}>
            {key}
          </div>
        )
      },
    },
    {
      accessorKey: 'scope',
      header: 'Scope',
      cell: ({ row }) => {
        const item = row.original
        const scopes = []

        if (item.organization_id) scopes.push('O')
        if (item.domain_id) scopes.push('D')
        if (item.environment_id) scopes.push('E')
        if (item.audience_id) scopes.push('A')

        if (scopes.length === 0) {
          return (
            <Badge variant="outline" className="text-xs">
              Global
            </Badge>
          )
        }

        return (
          <div className="flex gap-1">
            {scopes.map((scope) => (
              <Badge key={scope} variant="secondary" className="text-xs w-5 h-5 p-0 flex items-center justify-center">
                {scope}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const description = row.getValue('description') as string
        return (
          <div className="max-w-[200px] truncate" title={description}>
            {description || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'payload',
      header: 'Payload',
      cell: ({ row }) => {
        const item = row.original
        const payload = item.payload

        // Always show the actual payload regardless of secret flag
        const displayValue =
          typeof payload === 'object'
            ? JSON.stringify(payload).substring(0, 100) + (JSON.stringify(payload).length > 100 ? '...' : '')
            : String(payload)

        return (
          <div className="flex items-center gap-2 max-w-[300px]">
            <span className="font-mono text-xs truncate" title={JSON.stringify(payload, null, 2)}>
              {displayValue}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleJsonEdit(item)}
              className="h-6 px-2 text-xs shrink-0">
              <Code2 className="h-3 w-3" />
            </Button>
          </div>
        )
      },
    },
    {
      accessorKey: 'is_secret',
      header: 'Secret',
      cell: ({ row }) => {
        const item = getItemWithOptimisticState(row.original)
        const isUpdating = updatingSecrets.has(item.id)
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={item.is_secret}
              onCheckedChange={() => handleToggleSecret(row.original)}
              disabled={isUpdating}
            />
            {isUpdating && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Active',
      cell: ({ row }) => {
        const item = getItemWithOptimisticState(row.original)
        const isUpdating = updatingActives.has(item.id)
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={item.is_active}
              onCheckedChange={() => handleToggleActive(row.original)}
              disabled={isUpdating}
            />
            {isUpdating && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Updated
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('updated_at'))
        return (
          <div className="text-sm">
            <div>{date.toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">{date.toLocaleTimeString()}</div>
          </div>
        )
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.id)}>Copy ID</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.key)}>Copy Key</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleJsonEdit(item)}>
                <Code2 className="mr-2 h-4 w-4" />
                Edit JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDeleteClick(item)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  })

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search keys, descriptions, payloads..."
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <EyeOff className="mr-2 h-4 w-4" />
              Columns
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" onClick={onRefresh}>
          Refresh
        </Button>
        <Button variant="secondary" onClick={handleInitialSetup}>
          Initial Setup
        </Button>
        <Button onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add New
        </Button>
      </div>

      <div className="rounded-md border max-h-[70vh] overflow-auto">
        <Table className="table-fixed min-w-full">
          <TableHeader className="sticky top-0 bg-muted/50 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }} className="bg-muted/50">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No settings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} setting(s) total.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>

      <JsonEditor
        open={jsonEditor.open}
        onClose={() => setJsonEditor({ open: false, item: null })}
        value={jsonEditor.item?.payload}
        onChange={handleJsonSave}
        title="Edit Setting Payload"
      />

      <Dialog open={!!deleteItem} onOpenChange={handleDeleteCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Setting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the setting "{deleteItem?.key}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInitialSetup} onOpenChange={handleInitialSetupClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initial Settings Setup</DialogTitle>
            <DialogDescription>
              This will create default global settings for your application. Existing settings with the same keys will
              be skipped.
            </DialogDescription>
          </DialogHeader>

          {setupResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-2">Setup Results:</h4>
                <div className="space-y-1 text-sm">
                  <div className="text-green-600">✓ Successfully created: {setupResult.success} settings</div>
                  <div className="text-yellow-600">⚠ Skipped existing: {setupResult.skipped} settings</div>
                  {setupResult.errors.length > 0 && (
                    <div className="text-red-600">
                      ✗ Errors: {setupResult.errors.length}
                      <ul className="list-disc list-inside ml-4 mt-1">
                        {setupResult.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={handleInitialSetupClose}>Close</Button>
              </div>
            </div>
          ) : isInitialSetup ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Processing settings...</span>
                  <span>
                    {setupProgress.current}/{setupProgress.total}
                  </span>
                </div>
                <Progress
                  value={setupProgress.total > 0 ? (setupProgress.current / setupProgress.total) * 100 : 0}
                  className="w-full"
                />
                {setupProgress.currentItem && (
                  <div className="text-sm text-muted-foreground">Current: {setupProgress.currentItem}</div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" disabled>
                  Cancel
                </Button>
                <Button disabled>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleInitialSetupClose}>
                Cancel
              </Button>
              <Button onClick={handleInitialSetupConfirm}>Confirm Setup</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
