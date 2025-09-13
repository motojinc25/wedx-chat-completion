import { DashboardKernel } from '@/features/dashboard'

export function DashboardPage() {
  return (
    <div className="h-full flex flex-col overflow-auto">
      <DashboardKernel />
    </div>
  )
}
