import { useCallback, useState } from 'react'
import { useApiClient } from '@/shared/utils/api'

interface ChatSession {
  id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

interface ChatMessage {
  id: string
  session_id: string
  user_id: string | null
  role: string
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export function useChatSessions() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const apiClient = useApiClient()

  const createNewSession = useCallback(
    async (title?: string): Promise<string | null> => {
      try {
        const token = await apiClient.getToken()
        const response = await fetch('/api/playground/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title }),
        })

        if (response.ok) {
          const session: ChatSession = await response.json()
          setCurrentSessionId(session.id)
          return session.id
        }
        console.error('Failed to create new session')
        return null
      } catch (error) {
        console.error('Error creating new session:', error)
        return null
      }
    },
    [apiClient],
  )

  const loadSessionMessages = useCallback(
    async (sessionId: string): Promise<ChatMessage[]> => {
      try {
        setIsLoadingSession(true)
        const token = await apiClient.getToken()
        const response = await fetch(`/api/playground/sessions/${sessionId}/messages`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const messages: ChatMessage[] = await response.json()
          return messages
        }
        console.error('Failed to load session messages')
        return []
      } catch (error) {
        console.error('Error loading session messages:', error)
        return []
      } finally {
        setIsLoadingSession(false)
      }
    },
    [apiClient],
  )

  const saveMessage = useCallback(
    async (
      sessionId: string,
      role: string,
      content: string,
      metadata?: Record<string, unknown>,
    ): Promise<ChatMessage | null> => {
      try {
        const token = await apiClient.getToken()
        const response = await fetch(`/api/playground/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            role,
            content,
            metadata: metadata || {},
          }),
        })

        if (response.ok) {
          const message: ChatMessage = await response.json()
          return message
        }
        console.error('Failed to save message')
        return null
      } catch (error) {
        console.error('Error saving message:', error)
        return null
      }
    },
    [apiClient],
  )

  const generateSessionTitle = useCallback(
    async (sessionId: string): Promise<string | null> => {
      try {
        const token = await apiClient.getToken()
        const response = await fetch(`/api/playground/sessions/${sessionId}/title`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const result = await response.json()
          return result.title
        }
        console.error('Failed to generate session title')
        return null
      } catch (error) {
        console.error('Error generating session title:', error)
        return null
      }
    },
    [apiClient],
  )

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null)
  }, [])

  const selectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
  }, [])

  return {
    currentSessionId,
    isLoadingSession,
    createNewSession,
    loadSessionMessages,
    saveMessage,
    generateSessionTitle,
    startNewChat,
    selectSession,
  }
}
