import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { useApiClient } from '@/shared/utils/api'

interface ChatSession {
  id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

interface ChatHistorySidebarProps {
  currentSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onNewChat: () => void
  onDeleteSession?: (sessionId: string) => void
}

export interface ChatHistorySidebarRef {
  addNewSession: (session: ChatSession) => void
  updateSessionTitle: (sessionId: string, title: string) => void
  removeSession: (sessionId: string) => void
  refreshSessions: () => void
}

export const ChatHistorySidebar = forwardRef<ChatHistorySidebarRef, ChatHistorySidebarProps>(
  ({ currentSessionId, onSessionSelect, onNewChat, onDeleteSession }, ref) => {
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const apiClient = useApiClient()

    const loadSessions = useCallback(async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/playground/sessions', {
          headers: {
            Authorization: `Bearer ${await apiClient.getToken()}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setSessions(data)
        } else {
          console.error('Failed to load chat sessions')
        }
      } catch (error) {
        console.error('Error loading chat sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }, [apiClient])

    useEffect(() => {
      loadSessions()
    }, [loadSessions])

    // Function to add a new session to the list
    const addNewSession = (session: ChatSession) => {
      setSessions((prev) => [session, ...prev])
    }

    // Function to update session title
    const updateSessionTitle = (sessionId: string, title: string) => {
      setSessions((prev) => prev.map((session) => (session.id === sessionId ? { ...session, title } : session)))
    }

    // Expose functions to parent component via ref
    const removeSession = useCallback((sessionId: string) => {
      setSessions((prev) => prev.filter((session) => session.id !== sessionId))
    }, [])

    const refreshSessions = useCallback(() => {
      loadSessions()
    }, [loadSessions])

    useImperativeHandle(ref, () => ({
      addNewSession,
      updateSessionTitle,
      removeSession,
      refreshSessions,
    }))

    const handleNewChat = () => {
      onNewChat()
    }

    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      const now = new Date()
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

      if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      if (diffInHours < 24 * 7) {
        return date.toLocaleDateString([], { weekday: 'short' })
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    const truncateTitle = (title: string | null) => {
      if (!title) return 'New Chat'
      return title.length > 30 ? `${title.slice(0, 30)}...` : title
    }

    if (isLoading) {
      return (
        <div className="w-64 border-r bg-muted/50 p-4">
          <div className="space-y-2">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-6 bg-muted animate-pulse rounded" />
            <div className="h-6 bg-muted animate-pulse rounded" />
            <div className="h-6 bg-muted animate-pulse rounded" />
          </div>
        </div>
      )
    }

    return (
      <div className="w-64 border-r bg-muted/50 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b">
          <Button onClick={handleNewChat} className="w-full justify-start gap-2" variant="outline">
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Chat Sessions List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No chat history yet</div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative rounded-lg transition-all duration-200 w-full ${
                    currentSessionId === session.id
                      ? 'bg-primary/15 border border-primary/30 shadow-sm'
                      : 'hover:bg-muted/70 border border-transparent'
                  }`}>
                  {/* Main session content - clickable area */}
                  {/* biome-ignore lint/a11y/useSemanticElements: Complex layout requires div with button role for delete button positioning */}
                  <div
                    className="p-3 cursor-pointer text-left"
                    onClick={() => onSessionSelect(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSessionSelect(session.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}>
                    <div className="flex items-start gap-2">
                      <MessageSquare
                        className={`w-4 h-4 mt-0.5 ${
                          currentSessionId === session.id ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium truncate ${
                            currentSessionId === session.id ? 'text-primary font-semibold' : 'text-foreground'
                          }`}>
                          {truncateTitle(session.title)}
                        </div>
                        <div
                          className={`text-xs ${
                            currentSessionId === session.id ? 'text-primary/70' : 'text-muted-foreground'
                          }`}>
                          {formatDate(session.updated_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delete button - shown on hover */}
                  <button
                    type="button"
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession?.(session.id)
                    }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  },
)

ChatHistorySidebar.displayName = 'ChatHistorySidebar'
