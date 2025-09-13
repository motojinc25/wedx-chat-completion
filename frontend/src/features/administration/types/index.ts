// Administration feature types

export interface User {
  id: string
  tenant_id: string
  oid: string
  issuer: string
  display_name: string | null
  upn: string | null
  email: string | null
  roles: string[]
  groups: string[]
  last_login_at: string | null
  organization_id: string | null
  domain_id: string | null
  environment_id: string | null
  created_at: string
  updated_at: string
  organization_name: string | null
  domain_name: string | null
  environment_name: string | null
}

export interface MasterDataOption {
  id: string
  name: string
  code: string
}

export interface MasterDataOptions {
  organizations: MasterDataOption[]
  domains: MasterDataOption[]
  environments: MasterDataOption[]
}

export interface UserUpdateRequest {
  organization_id: string | null
  domain_id: string | null
  environment_id: string | null
}

export interface Tenant {
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
  user_count: number
}

export interface HealthCheckResponse {
  message: string
  authenticated_user: string
}

export interface AdminTabConfig {
  id: string
  title: string
  description?: string
}
