import type { Configuration, PopupRequest } from '@azure/msal-browser'

// App mode configuration
export const appMode = (import.meta.env.VITE_APP_MODE || 'development') as 'development' | 'production' | 'demo'

// Check if authentication should be disabled (only in demo mode)
export const isAuthDisabled = appMode === 'demo'

// MSAL configuration
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// Scopes for Login access
export const loginRequest: PopupRequest = {
  scopes: ['User.Read'],
}

// Scopes for API access
export const apiScopes = {
  scopes: [`${import.meta.env.VITE_AZURE_CLIENT_ID}/.default`],
}
