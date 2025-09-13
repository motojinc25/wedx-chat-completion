import { Building, Database, Globe, Server, Settings, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui'
import { cn } from '@/shared/utils'
import {
  DataTable,
  MasterDataFormDialog,
  SettingsDataTable,
  SettingsFormDialog,
  type SetupProgressCallback,
} from '../components'
import { DEFAULT_SETTINGS } from '../config/default-settings'
import { useMasterData, useSettingsData } from '../hooks'
import type {
  AudienceItem,
  BaseDataItem,
  DataManagementTabConfig,
  DomainItem,
  EnvironmentItem,
  OrganizationItem,
  SettingsItem,
} from '../types'

const tabConfigs: DataManagementTabConfig[] = [
  {
    id: 'organization',
    title: 'Organizations',
    description: 'Manage organizational units and hierarchies',
  },
  {
    id: 'domain',
    title: 'Domains',
    description: 'Manage business domains and areas',
  },
  {
    id: 'environment',
    title: 'Environments',
    description: 'Manage deployment environments',
  },
  {
    id: 'audience',
    title: 'Audiences',
    description: 'Manage target audiences and user groups',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Manage application configuration settings',
  },
]

const getTabIcon = (tabId: string) => {
  switch (tabId) {
    case 'organization':
      return Building
    case 'domain':
      return Globe
    case 'environment':
      return Server
    case 'audience':
      return Users
    case 'settings':
      return Settings
    default:
      return Database
  }
}

export function DataManagementPage() {
  const [activeTab, setActiveTab] = useState<string>('organization')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDialogLoading, setIsDialogLoading] = useState(false)
  const [editingItem, setEditingItem] = useState<BaseDataItem | SettingsItem | undefined>(undefined)

  // Lazy-loaded data hooks - only load when tab is active OR when settings dialog needs master data
  const needsMasterData = activeTab === 'settings' && isDialogOpen
  const organizationData = useMasterData<OrganizationItem>(
    'organization',
    activeTab === 'organization' || needsMasterData,
  )
  const domainData = useMasterData<DomainItem>('domain', activeTab === 'domain' || needsMasterData)
  const environmentData = useMasterData<EnvironmentItem>('environment', activeTab === 'environment' || needsMasterData)
  const audienceData = useMasterData<AudienceItem>('audience', activeTab === 'audience' || needsMasterData)

  // Settings hook - only load when settings tab is active
  const settingsData = useSettingsData(activeTab === 'settings')

  const getCurrentData = () => {
    switch (activeTab) {
      case 'organization':
        return organizationData
      case 'domain':
        return domainData
      case 'environment':
        return environmentData
      case 'audience':
        return audienceData
      default:
        return organizationData
    }
  }

  const handleAdd = () => {
    setEditingItem(undefined)
    setIsDialogOpen(true)
  }

  const handleEdit = (item: BaseDataItem | SettingsItem) => {
    setEditingItem(item)
    setIsDialogOpen(true)
  }

  const handleDelete = async (item: BaseDataItem | SettingsItem) => {
    if (activeTab === 'settings') {
      try {
        await settingsData.deleteSetting(item.id)
      } catch (error) {
        console.error('Failed to delete setting:', error)
      }
    } else {
      try {
        const currentData = getCurrentData()
        await currentData.remove(item.id)
      } catch (error) {
        console.error('Failed to delete item:', error)
        alert(`Failed to delete ${activeTab}`)
      }
    }
  }

  const handleToggleActive = async (item: BaseDataItem | SettingsItem) => {
    if (activeTab === 'settings') {
      try {
        await settingsData.toggleSettingActive(item.id, !item.is_active)
      } catch (error) {
        console.error('Failed to toggle setting active state:', error)
      }
    } else {
      try {
        const currentData = getCurrentData()
        await currentData.update(item.id, { is_active: !item.is_active })
      } catch (error) {
        console.error('Failed to update item status:', error)
        alert(`Failed to update ${activeTab} status`)
      }
    }
  }

  const handleToggleSecret = async (item: SettingsItem) => {
    try {
      await settingsData.toggleSettingSecret(item.id, !item.is_secret)
    } catch (error) {
      console.error('Failed to toggle setting secret state:', error)
    }
  }

  const handleSave = async (formData: Record<string, unknown>) => {
    setIsDialogLoading(true)
    try {
      if (activeTab === 'settings') {
        if (editingItem) {
          await settingsData.updateSetting(editingItem.id, formData)
        } else {
          await settingsData.createSetting(formData)
        }
      } else {
        const currentData = getCurrentData()
        if (editingItem) {
          await currentData.update(editingItem.id, formData)
        } else {
          await currentData.create(
            formData as Omit<BaseDataItem, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>,
          )
        }
      }
      setIsDialogOpen(false)
      setEditingItem(undefined)
    } catch (error) {
      console.error('Failed to save item:', error)
      if (activeTab !== 'settings') {
        alert(editingItem ? `Failed to update ${activeTab}` : `Failed to create ${activeTab}`)
      }
    } finally {
      setIsDialogLoading(false)
    }
  }

  const handleSettingPayloadEdit = async (item: SettingsItem, newPayload: unknown) => {
    try {
      await settingsData.updateSetting(item.id, { payload: newPayload })
    } catch (error) {
      console.error('Failed to update setting payload:', error)
    }
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingItem(undefined)
  }

  const handleInitialSetup = async (
    onProgress?: SetupProgressCallback,
  ): Promise<{ skipped: number; success: number; errors: string[] }> => {
    let skipped = 0
    let success = 0
    const errors: string[] = []
    const total = DEFAULT_SETTINGS.length
    let current = 0

    // Initialize progress
    onProgress?.(0, total, '')

    // Get existing global settings keys to check for duplicates
    const existingKeys = new Set(
      settingsData.settings
        .filter(
          (setting) =>
            !setting.organization_id && !setting.domain_id && !setting.environment_id && !setting.audience_id,
        )
        .map((setting) => setting.key),
    )

    for (const defaultSetting of DEFAULT_SETTINGS) {
      current++
      onProgress?.(current, total, defaultSetting.name)

      try {
        // Skip if setting with same key already exists as global setting
        if (existingKeys.has(defaultSetting.key)) {
          skipped++
          continue
        }

        // Create the setting
        await settingsData.createSetting({
          key: defaultSetting.key,
          name: defaultSetting.name,
          description: defaultSetting.description,
          payload: defaultSetting.payload,
          is_secret: defaultSetting.is_secret,
          is_active: defaultSetting.is_active,
          // No scope specified = Global setting
          organization_id: undefined,
          domain_id: undefined,
          environment_id: undefined,
          audience_id: undefined,
        })
        success++

        // Add a small delay to show progress visually
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Failed to create setting ${defaultSetting.key}:`, error)
        errors.push(
          `Failed to create setting "${defaultSetting.key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    return { skipped, success, errors }
  }

  const renderTabContent = () => {
    if (activeTab === 'settings') {
      return (
        <SettingsDataTable
          data={settingsData.settings}
          isLoading={settingsData.isLoading}
          onRefresh={settingsData.refresh}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onToggleSecret={handleToggleSecret}
          onPayloadEdit={handleSettingPayloadEdit}
          onInitialSetup={handleInitialSetup}
        />
      )
    }

    const currentData = getCurrentData()
    const currentTab = tabConfigs.find((tab) => tab.id === activeTab)

    return (
      <DataTable
        title={currentTab?.title || activeTab}
        data={currentData.data}
        isLoading={currentData.isLoading}
        onRefresh={currentData.refresh}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />
    )
  }

  const renderDialog = () => {
    if (activeTab === 'settings') {
      return (
        <SettingsFormDialog
          open={isDialogOpen}
          onClose={handleDialogClose}
          onSave={handleSave}
          item={editingItem as SettingsItem}
          isLoading={isDialogLoading}
          organizations={organizationData.data.filter((org) => org.is_active)}
          domains={domainData.data.filter((domain) => domain.is_active)}
          environments={environmentData.data.filter((env) => env.is_active)}
          audiences={audienceData.data.filter((aud) => aud.is_active)}
        />
      )
    }

    const currentTab = tabConfigs.find((tab) => tab.id === activeTab)
    return (
      <MasterDataFormDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        onSave={handleSave}
        item={editingItem}
        title={currentTab?.title?.slice(0, -1) || activeTab} // Remove 's' from plural
        isLoading={isDialogLoading}
      />
    )
  }

  return (
    <div className="h-full p-4">
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b">
          {tabConfigs.map((tab) => {
            const Icon = getTabIcon(tab.id)
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                className={cn(
                  'flex items-center gap-2 px-4 py-2',
                  activeTab === tab.id && 'border-b-2 border-primary rounded-b-none',
                )}
                onClick={() => setActiveTab(tab.id)}>
                <Icon className="h-4 w-4" />
                {tab.title}
              </Button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div>{renderTabContent()}</div>
      </div>

      {renderDialog()}
    </div>
  )
}
