import type { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Building2, Clock, Edit, Mail, MapPin, MoreHorizontal, Trash2, UserIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { MasterDataOptions, User, UserUpdateRequest } from '../types'
import { UserEditDialog } from './user-edit-dialog'

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | undefined>()
  const [masterDataOptions, setMasterDataOptions] = useState<MasterDataOptions>({
    organizations: [],
    domains: [],
    environments: [],
  })
  const [updateLoading, setUpdateLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const resetModalState = useCallback(() => {
    setEditDialogOpen(false)
    setDeleteDialogOpen(false)
    setSelectedUser(undefined)
  }, [])

  const handleEditUser = useCallback((user: User) => {
    setDeleteDialogOpen(false) // Ensure delete dialog is closed
    setSelectedUser(user)
    setEditDialogOpen(true)
  }, [])

  const handleDeleteUser = useCallback((user: User) => {
    setEditDialogOpen(false) // Ensure edit dialog is closed
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }, [])

  const confirmDeleteUser = async () => {
    if (!selectedUser) return

    setDeleteLoading(true)
    try {
      await apiClient.delete(`/admin/users/${selectedUser.id}`)
      setUsers(users.filter((user) => user.id !== selectedUser.id))
      toast.success('User deleted successfully')
      resetModalState()
    } catch (error: unknown) {
      const apiError = error as { status?: number; response?: { data?: { detail?: string } }; message?: string }
      const errorMessage = apiError?.response?.data?.detail || apiError?.message || 'Failed to delete user'

      // Check if this is a validation error (400) - expected business logic constraint
      if (apiError?.status === 400 || errorMessage.includes('Cannot delete')) {
        // This is expected validation - don't log as error
        toast.warning(errorMessage, {
          duration: 5000,
        })
      } else {
        // Only log unexpected errors
        console.error('Error deleting user:', error)
        toast.error(errorMessage)
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  const columns: ColumnDef<User>[] = useMemo(
    () => [
      {
        accessorKey: 'display_name',
        header: ({ column }) => {
          return (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              <UserIcon className="mr-2 h-4 w-4" />
              Display Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue('display_name') as string | null
          const upn = row.original.upn
          return (
            <div>
              <div className="font-medium">
                {value || <span className="text-muted-foreground italic">No display name</span>}
              </div>
              {upn && <div className="text-xs text-muted-foreground">{upn}</div>}
            </div>
          )
        },
      },
      {
        accessorKey: 'email',
        header: ({ column }) => {
          return (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              <Mail className="mr-2 h-4 w-4" />
              Email
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue('email') as string | null
          return (
            <div className="text-sm">{value || <span className="text-muted-foreground italic">No email</span>}</div>
          )
        },
      },
      {
        accessorKey: 'tenant_id',
        header: ({ column }) => {
          return (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              <Building2 className="mr-2 h-4 w-4" />
              Tenant ID
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const tenantId = row.original.tenant_id
          return <div className="text-sm font-mono">{tenantId}</div>
        },
      },
      {
        id: 'master_data',
        header: ({ column }) => {
          return (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              <MapPin className="mr-2 h-4 w-4" />
              Assignments
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const user = row.original
          const assignments = []

          if (user.organization_name) assignments.push(`Org: ${user.organization_name}`)
          if (user.domain_name) assignments.push(`Domain: ${user.domain_name}`)
          if (user.environment_name) assignments.push(`Env: ${user.environment_name}`)

          return (
            <div className="space-y-1">
              {assignments.length > 0 ? (
                assignments.map((assignment) => (
                  <div key={assignment} className="text-xs text-muted-foreground">
                    {assignment}
                  </div>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">No assignments</span>
              )}
            </div>
          )
        },
        sortingFn: (rowA, rowB) => {
          const aAssignments = [
            rowA.original.organization_name,
            rowA.original.domain_name,
            rowA.original.environment_name,
          ]
            .filter(Boolean)
            .join(' ')
          const bAssignments = [
            rowB.original.organization_name,
            rowB.original.domain_name,
            rowB.original.environment_name,
          ]
            .filter(Boolean)
            .join(' ')
          return aAssignments.localeCompare(bAssignments)
        },
      },
      {
        accessorKey: 'roles',
        header: 'Roles',
        cell: ({ row }) => {
          const roles = row.getValue('roles') as string[]
          return (
            <div className="flex flex-wrap gap-1">
              {roles.length > 0 ? (
                roles.slice(0, 2).map((role) => (
                  <Badge key={role} variant="secondary" className="text-xs">
                    {role}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">No roles</span>
              )}
              {roles.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{roles.length - 2}
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'last_login_at',
        header: ({ column }) => {
          return (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              <Clock className="mr-2 h-4 w-4" />
              Last Login
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue('last_login_at') as string | null
          return (
            <div className="text-sm">
              {value ? (
                <>
                  <div>{new Date(value).toLocaleDateString()}</div>
                  <div className="text-xs text-muted-foreground">{new Date(value).toLocaleTimeString()}</div>
                </>
              ) : (
                <span className="text-muted-foreground italic">Never</span>
              )}
            </div>
          )
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
        id: 'oid',
        header: 'Object ID',
        accessorKey: 'oid',
        cell: ({ row }) => {
          const value = row.getValue('oid') as string
          return <div className="font-mono text-xs">{value}</div>
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const user = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEditUser(user)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Assignments
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="text-red-600 hover:text-red-700">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [handleEditUser, handleDeleteUser],
  )

  const fetchUsers = useCallback(async (search = '', tenant_id = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      if (tenant_id) {
        params.append('tenant_id', tenant_id)
      }
      params.append('limit', '100')

      const data = await apiClient.get<User[]>(`/admin/users?${params}`)
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMasterDataOptions = useCallback(async () => {
    try {
      const data = await apiClient.get<MasterDataOptions>('/admin/users/master-data-options')
      setMasterDataOptions(data)
    } catch (error) {
      console.error('Error fetching master data options:', error)
      toast.error('Failed to load options')
    }
  }, [])

  const handleUpdateUser = async (updateData: UserUpdateRequest) => {
    if (!selectedUser) return

    setUpdateLoading(true)
    try {
      const updatedUser = await apiClient.put<User>(`/admin/users/${selectedUser.id}`, updateData)
      setUsers(users.map((user) => (user.id === selectedUser.id ? updatedUser : user)))
      toast.success('User updated successfully')
      resetModalState()
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user')
    } finally {
      setUpdateLoading(false)
    }
  }

  useEffect(() => {
    // Check for tenant_id query parameter
    const urlParams = new URLSearchParams(window.location.search)
    const tenantId = urlParams.get('tenant_id')
    if (tenantId) {
      setTenantFilter(tenantId)
      fetchUsers('', tenantId)
    } else {
      fetchUsers()
    }
    // Also fetch master data options on mount
    fetchMasterDataOptions()
  }, [fetchUsers, fetchMasterDataOptions])

  const handleSearch = (value: string) => {
    setSearchValue(value)
    // Debounce search
    const timer = setTimeout(() => {
      fetchUsers(value, tenantFilter)
    }, 300)
    return () => clearTimeout(timer)
  }

  const handleRefresh = () => {
    fetchUsers(searchValue, tenantFilter)
  }

  const clearTenantFilter = () => {
    setTenantFilter('')
    // Update URL without tenant_id parameter
    const url = new URL(window.location.href)
    url.searchParams.delete('tenant_id')
    window.history.replaceState(null, '', url.toString())
    fetchUsers(searchValue, '')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </Badge>
          {tenantFilter && (
            <Badge variant="outline" className="gap-2">
              Filtered by tenant: {tenantFilter}
              <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={clearTenantFilter}>
                ×
              </Button>
            </Badge>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="Search users by name, email, or tenant..."
        isLoading={loading}
        onSearch={handleSearch}
        searchValue={searchValue}
        onRefresh={handleRefresh}
      />

      <UserEditDialog
        open={editDialogOpen}
        onClose={resetModalState}
        onSave={handleUpdateUser}
        user={selectedUser}
        isLoading={updateLoading}
        organizations={masterDataOptions.organizations}
        domains={masterDataOptions.domains}
        environments={masterDataOptions.environments}
      />

      <Dialog
        key={selectedUser?.id}
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setSelectedUser(undefined)
            // Force remove any lingering overlay styles
            setTimeout(() => {
              document.body.style.pointerEvents = ''
            }, 100)
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user "{selectedUser?.display_name || selectedUser?.upn}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setSelectedUser(undefined)
                // Force remove any lingering overlay styles
                setTimeout(() => {
                  document.body.style.pointerEvents = ''
                }, 100)
              }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUser} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
