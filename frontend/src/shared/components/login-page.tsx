import { Button } from '@/shared/components/ui'
import { useAuth } from '@/shared/contexts'

export const LoginPage = () => {
  const { login, isLoading } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-testid="login-page">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight">WeDX</h2>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with Microsoft account to continue</p>
        </div>
        <div className="mt-8 space-y-6">
          <Button onClick={login} disabled={isLoading} className="w-full" size="lg">
            {isLoading ? 'Signing in...' : 'Sign in with Microsoft'}
          </Button>
        </div>
      </div>
    </div>
  )
}
