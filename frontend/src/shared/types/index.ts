// Global types that are used across multiple features

export interface User {
  name?: string
  username?: string
}

export interface ApiError {
  message: string
  status?: number
}

// Common UI component props
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}
