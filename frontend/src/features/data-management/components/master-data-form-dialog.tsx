import type React from 'react'
import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
} from '@/shared/components/ui'
import type { BaseDataItem } from '../types'

interface MasterDataFormDialogProps<T extends BaseDataItem> {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<T>) => void
  item?: T
  title: string
  isLoading?: boolean
}

export function MasterDataFormDialog<T extends BaseDataItem>({
  open,
  onClose,
  onSave,
  item,
  title,
  isLoading = false,
}: MasterDataFormDialogProps<T>) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
  })

  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code || '',
        name: item.name || '',
        description: item.description || '',
        is_active: item.is_active ?? true,
      })
    } else {
      setFormData({
        code: '',
        name: '',
        description: '',
        is_active: true,
      })
    }
  }, [item])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData as Partial<T>)
  }

  const isEdit = !!item

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${title}` : `Add New ${title}`}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? `Make changes to this ${title.toLowerCase()} here.`
                : `Add a new ${title.toLowerCase()} to the system.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="code" className="text-right text-sm font-medium">
                Code *
              </label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="col-span-3"
                required
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">
                Name *
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                required
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="description" className="text-right text-sm font-medium">
                Description
              </label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="is_active" className="text-right text-sm font-medium">
                Active
              </label>
              <div className="col-span-3">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
