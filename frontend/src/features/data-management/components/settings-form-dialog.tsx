import { useEffect, useState } from 'react'
import { JsonEditorMonaco } from '@/shared/components/json-editor-monaco'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/shared/components/ui'
import type { MasterDataOption, SettingsItem } from '../types'

interface SettingsFormDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<SettingsItem>) => void
  item?: SettingsItem
  isLoading?: boolean
  organizations: MasterDataOption[]
  domains: MasterDataOption[]
  environments: MasterDataOption[]
  audiences: MasterDataOption[]
}

export function SettingsFormDialog({
  open,
  onClose,
  onSave,
  item,
  isLoading = false,
  organizations,
  domains,
  environments,
  audiences,
}: SettingsFormDialogProps) {
  const [formData, setFormData] = useState({
    key: '',
    payload: '{\n  "value": ""\n}',
    description: '',
    is_secret: false,
    organization_id: 'none',
    domain_id: 'none',
    environment_id: 'none',
    audience_id: 'none',
    is_active: true,
  })
  const [isJsonValid, setIsJsonValid] = useState(true)

  useEffect(() => {
    if (item) {
      setFormData({
        key: item.key || '',
        payload: typeof item.payload === 'object' ? JSON.stringify(item.payload, null, 2) : String(item.payload || ''),
        description: item.description || '',
        is_secret: item.is_secret ?? false,
        organization_id: item.organization_id || 'none',
        domain_id: item.domain_id || 'none',
        environment_id: item.environment_id || 'none',
        audience_id: item.audience_id || 'none',
        is_active: item.is_active ?? true,
      })
    } else {
      setFormData({
        key: '',
        payload: '{\n  "value": ""\n}',
        description: '',
        is_secret: false,
        organization_id: 'none',
        domain_id: 'none',
        environment_id: 'none',
        audience_id: 'none',
        is_active: true,
      })
    }
  }, [item])

  const handlePayloadChange = (payload: string) => {
    setFormData({ ...formData, payload })
  }

  const handleJsonValidationChange = (valid: boolean) => {
    setIsJsonValid(valid)
  }

  const validateJson = (payload: string) => {
    if (!payload.trim()) {
      return null
    }

    try {
      return JSON.parse(payload)
    } catch {
      return payload
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isJsonValid) {
      return
    }

    const parsedPayload = validateJson(formData.payload)

    const submitData: Partial<SettingsItem> = {
      key: formData.key,
      payload: parsedPayload,
      description: formData.description,
      is_secret: formData.is_secret,
      organization_id: formData.organization_id === 'none' ? undefined : formData.organization_id,
      domain_id: formData.domain_id === 'none' ? undefined : formData.domain_id,
      environment_id: formData.environment_id === 'none' ? undefined : formData.environment_id,
      audience_id: formData.audience_id === 'none' ? undefined : formData.audience_id,
      is_active: formData.is_active,
    }

    onSave(submitData)
  }

  const isEdit = !!item

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Setting' : 'Add New Setting'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Make changes to this setting here.' : 'Add a new configuration setting to the system.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="key" className="text-right text-sm font-medium">
                Key *
              </Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                className="col-span-3 font-mono text-sm"
                placeholder="e.g. rag.settings.temperature"
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right text-sm font-medium">
                Description
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                placeholder="Brief description of this setting"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="payload" className="text-right text-sm font-medium pt-2">
                Payload *
              </Label>
              <div className="col-span-3">
                <div className="border rounded-md overflow-hidden">
                  <JsonEditorMonaco
                    value={formData.payload}
                    onChange={handlePayloadChange}
                    onValidationChange={handleJsonValidationChange}
                    disabled={isLoading}
                    height={120}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="organization" className="text-right text-sm font-medium">
                Organization
              </Label>
              <Select
                value={formData.organization_id}
                onValueChange={(value) => setFormData({ ...formData, organization_id: value })}
                disabled={isLoading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select organization (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Global)</SelectItem>
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
                value={formData.domain_id}
                onValueChange={(value) => setFormData({ ...formData, domain_id: value })}
                disabled={isLoading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select domain (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Global)</SelectItem>
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
                value={formData.environment_id}
                onValueChange={(value) => setFormData({ ...formData, environment_id: value })}
                disabled={isLoading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select environment (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Global)</SelectItem>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name} ({env.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="audience" className="text-right text-sm font-medium">
                Audience
              </Label>
              <Select
                value={formData.audience_id}
                onValueChange={(value) => setFormData({ ...formData, audience_id: value })}
                disabled={isLoading}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select audience (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Global)</SelectItem>
                  {audiences.map((aud) => (
                    <SelectItem key={aud.id} value={aud.id}>
                      {aud.name} ({aud.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_secret" className="text-right text-sm font-medium">
                Secret
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="is_secret"
                  checked={formData.is_secret}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_secret: checked })}
                  disabled={isLoading}
                />
                <span className="text-sm text-muted-foreground">Excluded from frontend queries</span>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_active" className="text-right text-sm font-medium">
                Active
              </Label>
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
            <Button type="submit" disabled={isLoading || !isJsonValid}>
              {isLoading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Setting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
