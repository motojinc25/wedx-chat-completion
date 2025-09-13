/**
 * Default settings configuration for initial setup
 * These settings will be created as Global settings (no organization/domain/environment/audience scope)
 */

export interface DefaultSetting {
  key: string
  name: string
  description: string
  payload: unknown
  is_secret: boolean
  is_active: boolean
}

export const DEFAULT_SETTINGS: DefaultSetting[] = [
  {
    key: 'ui.page.dashboard.refresh.interval_sec',
    name: 'Dashboard Refresh Interval',
    description: 'Auto-refresh interval for dashboard page in seconds',
    payload: '{"value":60}',
    is_secret: false,
    is_active: true,
  },
]
