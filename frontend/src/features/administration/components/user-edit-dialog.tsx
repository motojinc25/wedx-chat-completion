import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui'
import type { MasterDataOption, User, UserUpdateRequest } from '../types'

interface UserEditDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: UserUpdateRequest) => void
  user?: User
  isLoading?: boolean
  organizations: MasterDataOption[]
  domains: MasterDataOption[]
  environments: MasterDataOption[]
}

export function UserEditDialog({
  open,
  onClose,
  onSave,
  user,
  isLoading = false,
  organizations,
  domains,
  environments,
}: UserEditDialogProps) {
  const [formData, setFormData] = useState<UserUpdateRequest>({
    organization_id: null,
    domain_id: null,
    environment_id: null,
  })

  useEffect(() => {
    if (user) {
      setFormData({
        organization_id: user.organization_id || null,
        domain_id: user.domain_id || null,
        environment_id: user.environment_id || null,
      })
    } else {
      setFormData({
        organization_id: null,
        domain_id: null,
        environment_id: null,
      })
    }
  }, [user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  if (!user) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose()
          // Force remove any lingering overlay styles
          setTimeout(() => {
            document.body.style.pointerEvents = ''
          }, 100)
        }
      }}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User Assignments</DialogTitle>
            <DialogDescription>
              Update organization, domain, and environment assignments for{' '}
              <strong>{user.display_name || user.upn || user.email || 'this user'}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="organization" className="text-right text-sm font-medium">
                Organization
              </Label>
              <Select
                value={formData.organization_id || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, organization_id: value === 'none' ? null : value })
                }
                disabled={isLoading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select organization (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="domain" className="text-right text-sm font-medium">
                Domain
              </Label>
              <Select
                value={formData.domain_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, domain_id: value === 'none' ? null : value })}
                disabled={isLoading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select domain (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {domains.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.name} ({domain.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="environment" className="text-right text-sm font-medium">
                Environment
              </Label>
              <Select
                value={formData.environment_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, environment_id: value === 'none' ? null : value })}
                disabled={isLoading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select environment (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name} ({env.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose()
                // Force remove any lingering overlay styles
                setTimeout(() => {
                  document.body.style.pointerEvents = ''
                }, 100)
              }}
              disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
