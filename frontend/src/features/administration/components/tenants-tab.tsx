import type { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { DataTable } from '@/shared/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { apiClient } from '@/shared/utils'

interface Tenant {
  id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

export function TenantsTab() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | undefined>()
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleDeleteTenant = useCallback((tenant: Tenant) => {
    // Pre-cleanup before opening new modal
    document.body.style.pointerEvents = ''
    document.body.removeAttribute('data-scroll-locked')

    setSelectedTenant(tenant)
    setDeleteDialogOpen(true)
  }, [])

  const confirmDeleteTenant = async () => {
    if (!selectedTenant) return

    setDeleteLoading(true)
    try {
      await apiClient.delete(`/admin/tenants/${selectedTenant.id}`)
      setTenants(tenants.filter((tenant) => tenant.id !== selectedTenant.id))
      setDeleteDialogOpen(false)
      setSelectedTenant(undefined)
      toast.success('Tenant deleted successfully')
      // Force remove any lingering overlay styles
      setTimeout(() => {
        document.body.style.pointerEvents = ''
      }, 100)
    } catch (error: unknown) {
      const apiError = error as { status?: number; response?: { data?: { detail?: string } }; message?: string }
      const errorMessage = apiError?.response?.data?.detail || apiError?.message || 'Failed to delete tenant'

      // Check if this is a validation error (400) about existing users
      if (
        apiError?.status === 400 ||
        errorMessage.includes('Cannot delete tenant') ||
        errorMessage.includes('user(s) associated with this tenant')
      ) {
        // This is expected validation - don't log as error
        toast.warning(errorMessage, {
          duration: 6000,
          description: 'Please navigate to Users and remove all users from this tenant first.',
        })
      } else {
        // Only log unexpected errors
        console.error('Error deleting tenant:', error)
        toast.error(errorMessage)
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  const columns: ColumnDef<Tenant>[] = useMemo(
    () => [
      {
        accessorKey: 'tenant_id',
        header: ({ column }) => {
          return (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              Tenant ID
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue('tenant_id') as string
          return <div className="font-mono text-xs">{value}</div>
        },
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => {
          return (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              Created At
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue('created_at') as string
          return <div className="text-sm">{new Date(value).toLocaleString()}</div>
        },
      },
      {
        accessorKey: 'updated_at',
        header: ({ column }) => {
          return (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              Updated At
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue('updated_at') as string
          return <div className="text-sm">{new Date(value).toLocaleString()}</div>
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const tenant = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    navigate(`/administration/users?tenant_id=${tenant.tenant_id}`)
                  }}>
                  <Users className="mr-2 h-4 w-4" />
                  View Users
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteTenant(tenant)}
                  className="text-red-600 hover:text-red-700">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Tenant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [handleDeleteTenant, navigate],
  )

  const fetchTenants = useCallback(async (search = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      params.append('limit', '100')

      const data = await apiClient.get<Tenant[]>(`/admin/tenants?${params}`)
      setTenants(data)
    } catch (error) {
      console.error('Error fetching tenants:', error)
      toast.error('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  // Fix modal overlay pointer events issue
  useEffect(() => {
    if (!deleteDialogOpen) {
      // When dialog is closed, ensure pointer events are restored
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = ''
        // Also remove any data attributes that might be causing issues
        document.body.removeAttribute('data-scroll-locked')

        // Force re-enable all interactions
        const clickBlockers = document.querySelectorAll('[data-radix-dialog-overlay]')
        clickBlockers.forEach((el) => el.remove())

        // Final check - if still blocked, force click enable
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = 'auto'
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [deleteDialogOpen])

  const handleSearch = (value: string) => {
    setSearchValue(value)
    // Debounce search
    const timer = setTimeout(() => {
      fetchTenants(value)
    }, 300)
    return () => clearTimeout(timer)
  }

  const handleRefresh = () => {
    fetchTenants(searchValue)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        searchPlaceholder="Search tenants by name or ID..."
        isLoading={loading}
        onSearch={handleSearch}
        searchValue={searchValue}
        onRefresh={handleRefresh}
      />

      <Dialog
        key={selectedTenant?.id}
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setSelectedTenant(undefined)
            // Force remove any lingering overlay styles
            setTimeout(() => {
              document.body.style.pointerEvents = ''
            }, 100)
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete tenant "{selectedTenant?.tenant_id}"? This action cannot be undone and
              will affect all associated users.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setSelectedTenant(undefined)
                // Force remove any lingering overlay styles
                setTimeout(() => {
                  document.body.style.pointerEvents = ''
                }, 100)
              }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteTenant} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
