import { Activity, ChevronDown, Database, GalleryVerticalEnd, Home, Info, MessageSquare, Settings } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/shared/components/ui/sidebar'
import { AboutModal } from '../about-modal'

const data = {
  navMain: [
    {
      title: 'Dashboard',
      url: '/',
      icon: Home,
      isActive: false,
    },
    {
      title: 'Chat Playground',
      url: '/playground',
      icon: MessageSquare,
      isActive: false,
    },
    {
      title: 'Data Management',
      url: '/data-management',
      icon: Database,
      isActive: false,
    },
    {
      title: 'Administration',
      url: '#',
      icon: Settings,
      isActive: false,
      items: [
        {
          title: 'Tenants',
          url: '/administration/tenants',
        },
        {
          title: 'Users',
          url: '/administration/users',
        },
      ],
    },
    {
      title: 'Observability',
      url: '#',
      icon: Activity,
      isActive: false,
      items: [
        {
          title: 'Overview',
          url: '/observability/overview',
        },
        {
          title: 'Logs',
          url: '/observability/logs',
        },
        {
          title: 'Traces',
          url: '/observability/traces',
        },
        {
          title: 'Metrics',
          url: '/observability/metrics',
        },
      ],
    },
  ],
}

interface BuildInfo {
  release_id: string
  built_at: string
  frontend_version: string
  backend_version: string
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const fetchBuildInfo = async () => {
      try {
        const response = await fetch('/api/version', {
          cache: 'no-store',
        })
        const data = await response.json()
        setBuildInfo(data)
      } catch (error) {
        console.error('Failed to fetch build info:', error)
        setBuildInfo({
          release_id: 'dev-error',
          built_at: 'unknown',
          frontend_version: 'unknown',
          backend_version: 'unknown',
        })
      }
    }

    fetchBuildInfo()
  }, [])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">WeDX</span>
                  <span className="text-xs text-muted-foreground">{buildInfo?.release_id || 'Loading...'}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.url
              const hasSubItems = item.items && item.items.length > 0
              const isSubItemActive = hasSubItems && item.items.some((subItem) => location.pathname === subItem.url)

              if (hasSubItems) {
                return (
                  <Collapsible key={item.title} asChild defaultOpen={isSubItemActive}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <CollapsibleTrigger className="font-medium">
                          <Icon className="size-4" />
                          <span>{item.title}</span>
                          <ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                        </CollapsibleTrigger>
                      </SidebarMenuButton>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <Link to={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              }

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link to={item.url} className="font-medium">
                      <Icon className="size-4" />
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setShowAboutModal(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              tooltip="About this application">
              <Info className="size-4" />
              <span>About</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} buildInfo={buildInfo} />
    </Sidebar>
  )
}
