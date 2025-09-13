export interface BaseDataItem {
  id: string
  code: string
  name: string
  description?: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_by?: string
  updated_at: string
}

export interface OrganizationItem extends BaseDataItem {
  // Additional organization-specific fields can be added here
}

export interface DomainItem extends BaseDataItem {
  // Additional domain-specific fields can be added here
}

export interface EnvironmentItem extends BaseDataItem {
  // Additional environment-specific fields can be added here
}

export interface AudienceItem extends BaseDataItem {
  // Additional audience-specific fields can be added here
}

export interface SettingsItem extends BaseDataItem {
  key: string
  payload: unknown
  is_secret: boolean
  organization_id?: string
  domain_id?: string
  environment_id?: string
  audience_id?: string
}

export type MasterDataType = 'organization' | 'domain' | 'environment' | 'audience'

export interface MasterDataOption {
  id: string
  code: string
  name: string
  is_active: boolean
}

export interface DataManagementTabConfig {
  id: MasterDataType | 'settings'
  title: string
  description: string
}
