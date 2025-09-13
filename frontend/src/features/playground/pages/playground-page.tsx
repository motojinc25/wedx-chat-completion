import {
  Bot,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Edit3,
  FileText,
  History,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Send,
  Settings,
  Square,
  User,
  X,
  Zap,
} from 'lucide-react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ChatHistorySidebar, type ChatHistorySidebarRef, MarkdownContent } from '@/shared/components'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Slider,
  Switch,
  Textarea,
} from '@/shared/components/ui'
import { useChatSessions } from '@/shared/hooks'
import { useApiClient } from '@/shared/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  functionCalls?: FunctionCall[]
}

interface ChatSession {
  id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

interface FunctionCall {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

interface StreamChunk {
  content: string
  function_calls: FunctionCall[]
  finish_reason: string | null
  role: string
}

// Helper functions for JSON detection and formatting
function isJsonString(str: string): boolean {
  if (typeof str !== 'string') return false
  const trimmed = str.trim()
  if (!trimmed) return false

  try {
    const parsed = JSON.parse(trimmed)
    return typeof parsed === 'object' && parsed !== null
  } catch {
    return false
  }
}

function isJsonObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function PlaygroundPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [systemMessage, setSystemMessage] = useState('You are a helpful assistant.')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isAborting, setIsAborting] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [currentStreamContent, setCurrentStreamContent] = useState('')
  const [currentFunctionCalls, setCurrentFunctionCalls] = useState<FunctionCall[]>([])
  const [uniqueFunctionCalls, setUniqueFunctionCalls] = useState<Set<string>>(new Set())
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null)
  const [createdNewSession, setCreatedNewSession] = useState<boolean>(false)
  const [hasGeneratedTitle, setHasGeneratedTitle] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [chatSettings, setChatSettings] = useState({
    maxTokens: 2000,
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    functionCalling: true,
  })
  const [textareaRows, setTextareaRows] = useState(1)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<ChatHistorySidebarRef>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const apiClient = useApiClient()

  const {
    currentSessionId,
    isLoadingSession,
    createNewSession,
    loadSessionMessages,
    saveMessage,
    generateSessionTitle,
    startNewChat,
    selectSession,
  } = useChatSessions()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const adjustTextareaHeight = useCallback((value: string) => {
    const lines = value.split('\n').length
    const calculatedRows = Math.max(1, Math.min(7, lines))
    setTextareaRows(calculatedRows)
  }, [])

  const abortMessage = useCallback(async () => {
    if (!abortController || !isLoading) return

    setIsAborting(true)

    try {
      abortController.abort()

      // Immediately clear streaming content to prevent double display
      const contentToSave = currentStreamContent
      const functionsToSave = [...currentFunctionCalls]

      setCurrentStreamContent('')
      setCurrentFunctionCalls([])
      setUniqueFunctionCalls(new Set())
      setIsThinking(false)
      setIsLoading(false)

      // Add abort message to chat only if there was content
      if (contentToSave || functionsToSave.length > 0) {
        const abortedMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `${contentToSave}${contentToSave ? '\n\n' : ''}*[Message generation was cancelled]*`,
          timestamp: new Date(),
          functionCalls: functionsToSave.length > 0 ? functionsToSave : undefined,
        }

        setMessages((prev) => [...prev, abortedMessage])

        // Save partial message to database if there's a session
        if (currentSessionId) {
          await saveMessage(currentSessionId, 'assistant', abortedMessage.content, {
            functionCalls: functionsToSave.length > 0 ? functionsToSave : undefined,
          })
        }
      }
    } catch (error) {
      console.error('Error during abort:', error)
    } finally {
      setIsAborting(false)
      setAbortController(null)
    }
  }, [abortController, isLoading, currentStreamContent, currentFunctionCalls, currentSessionId, saveMessage])

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages and currentStreamContent are needed to trigger scroll on content changes
  useEffect(() => {
    scrollToBottom()
  }, [messages, currentStreamContent, scrollToBottom])

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load session messages when a session is selected (but not for newly created sessions)
  useEffect(() => {
    if (currentSessionId && currentSessionId !== loadedSessionId) {
      const loadMessages = async () => {
        const sessionMessages = await loadSessionMessages(currentSessionId)

        if (sessionMessages.length > 0 || messages.length === 0) {
          const formattedMessages = sessionMessages.map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: new Date(msg.created_at),
            functionCalls: msg.metadata?.functionCalls as FunctionCall[] | undefined,
          }))
          setMessages(formattedMessages)
          setHasGeneratedTitle(sessionMessages.filter((msg) => msg.role !== 'user').length > 0)
        }

        setLoadedSessionId(currentSessionId) // mark as loaded to prevent Re-rendering of messages when we can load them manually in js and save them to the server for rejoining chats only.
      }

      loadMessages()
    }
  }, [currentSessionId, loadedSessionId, loadSessionMessages, messages.length])

  useEffect(() => {
    if (currentSessionId === null) {
      setLoadedSessionId(null)
    }
  }, [currentSessionId])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessageContent = input
    let sessionId = currentSessionId

    // Create abort controller for this request
    const controller = new AbortController()
    setAbortController(controller)

    // Batch all UI state updates together to avoid multiple re-renders
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    }

    // Single batch update for all UI state changes
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setTextareaRows(1)
    setIsLoading(true)
    setIsThinking(true)
    setCurrentStreamContent('')
    setCurrentFunctionCalls([])
    setUniqueFunctionCalls(new Set())

    // Pre-fetch token to avoid multiple calls
    const token = await apiClient.getToken()

    try {
      // Handle session creation asynchronously without blocking AI request
      const sessionPromise = !sessionId
        ? (async () => {
            setCreatedNewSession(true)
            const newSessionId = await createNewSession()
            if (!newSessionId) {
              console.error('Failed to create new session')
              return null
            }

            // Add new session to sidebar
            if (sidebarRef.current) {
              sidebarRef.current.addNewSession({
                id: newSessionId,
                user_id: 'current-user',
                title: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            }
            return newSessionId
          })()
        : Promise.resolve(sessionId)

      // Prepare AI request data
      const requestData = {
        messages: [
          ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
          { role: userMessage.role, content: userMessage.content },
        ],
        system_message: systemMessage || undefined,
        max_tokens: chatSettings.maxTokens,
        temperature: chatSettings.temperature,
        top_p: chatSettings.topP,
        frequency_penalty: chatSettings.frequencyPenalty,
        presence_penalty: chatSettings.presencePenalty,
        function_calling: chatSettings.functionCalling,
      }

      // Start AI request immediately without waiting for session creation or message save
      const aiResponsePromise = fetch('/api/ai/chat/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      })

      // Wait for session creation to complete
      const finalSessionId = await sessionPromise
      if (!finalSessionId) {
        throw new Error('Failed to create session')
      }
      sessionId = finalSessionId

      // Save user message in background - don't block AI response
      saveMessage(sessionId, 'user', userMessage.content)
        .then((savedUserMessage) => {
          if (savedUserMessage) {
            // Update the message with the real database ID
            setMessages((prev) =>
              prev.map((msg) => (msg.id === userMessage.id ? { ...msg, id: savedUserMessage.id } : msg)),
            )
          }
        })
        .catch((error) => {
          console.error('Failed to save user message:', error)
        })

      // Process AI response
      const response = await aiResponsePromise

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let assistantMessage = ''
      let allFunctionCalls: FunctionCall[] = []
      let shouldUpdateThinking = false
      let lastUpdateTime = 0
      const UPDATE_THROTTLE_MS = 50 // Throttle UI updates to 20 FPS for better performance

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setIsThinking(false)
              continue
            }

            try {
              const parsed: StreamChunk = JSON.parse(data)

              if (parsed.content) {
                assistantMessage += parsed.content
                shouldUpdateThinking = false

                // Throttle content updates to reduce re-renders
                const now = Date.now()
                if (now - lastUpdateTime > UPDATE_THROTTLE_MS) {
                  setCurrentStreamContent(assistantMessage)
                  setIsThinking(false)
                  lastUpdateTime = now
                }
              }

              if (parsed.function_calls && parsed.function_calls.length > 0) {
                // Add only unique function calls to avoid duplicates
                const newFunctionCalls = parsed.function_calls.filter((call) => {
                  const callId = `${call.name}-${JSON.stringify(call.arguments)}`
                  if (uniqueFunctionCalls.has(callId)) {
                    return false
                  }
                  uniqueFunctionCalls.add(callId)
                  return true
                })

                if (newFunctionCalls.length > 0) {
                  allFunctionCalls = [...allFunctionCalls, ...newFunctionCalls]
                  setCurrentFunctionCalls(allFunctionCalls)
                  setUniqueFunctionCalls(new Set(uniqueFunctionCalls))
                  shouldUpdateThinking = true
                }
              }

              // Handle tool_calls finish reason - this indicates function calling is happening
              if (parsed.finish_reason === 'tool_calls') {
                shouldUpdateThinking = true
                continue
              }

              if (parsed.finish_reason === 'stop' || parsed.finish_reason === 'completed') {
                shouldUpdateThinking = false
              }

              if (parsed.finish_reason === 'content_filter') {
                shouldUpdateThinking = false
              }

              if (parsed.finish_reason === 'error') {
                shouldUpdateThinking = false
                break
              }

              // Update thinking state only when necessary
              if (shouldUpdateThinking) {
                setIsThinking(true)
                shouldUpdateThinking = false
              }
            } catch (e) {
              console.error('Error parsing chunk:', e)
              console.error('Chunk data:', data)
            }
          }
        }
      }

      // Final content update
      setCurrentStreamContent(assistantMessage)
      setIsThinking(false)

      // Add final assistant message
      const finalMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
        functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
      }

      setMessages((prev) => [...prev, finalMessage])
      setCurrentStreamContent('')
      setCurrentFunctionCalls([])
      setUniqueFunctionCalls(new Set())

      // Save assistant message to database in background - don't block UI
      if (sessionId) {
        saveMessage(sessionId, 'assistant', assistantMessage, {
          functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
        })
          .then((savedMessage) => {
            if (savedMessage) {
              // Update message with real database ID
              setMessages((prev) =>
                prev.map((msg) => (msg.id === finalMessage.id ? { ...msg, id: savedMessage.id } : msg)),
              )
            }
          })
          .catch((error) => {
            console.error('Failed to save assistant message:', error)
          })

        // Generate title after first conversation exchange (only once) - defer to avoid kernel conflicts
        if (!hasGeneratedTitle && messages.filter((msg) => msg.role !== 'user').length === 0) {
          setHasGeneratedTitle(true) // Set immediately to prevent duplicate calls
          // Use queueMicrotask to defer execution until after current call stack
          queueMicrotask(async () => {
            try {
              await new Promise((resolve) => setTimeout(resolve, 500)) // Brief delay for kernel cleanup
              const generatedTitle = sessionId ? await generateSessionTitle(sessionId) : null
              if (generatedTitle && sidebarRef.current && sessionId) {
                sidebarRef.current.updateSessionTitle(sessionId, generatedTitle)
              }
            } catch (error) {
              console.error('Error generating session title:', error)
            }
          })
        }
      }
    } catch (error) {
      // Handle abort case separately to avoid showing error message
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      console.error('Error in chat completion:', error)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setCreatedNewSession(false)
      setIsThinking(false)
      setAbortController(null)
    }
  }

  const clearMessages = () => {
    setMessages([])
    setCurrentStreamContent('')
    setCurrentFunctionCalls([])
    setUniqueFunctionCalls(new Set())
    setHasGeneratedTitle(false)
  }

  const handleNewChat = () => {
    startNewChat()
    clearMessages()
  }

  const handleSessionSelect = (sessionId: string) => {
    selectSession(sessionId)
    clearMessages() // Clear current messages, they will be loaded by useEffect
  }

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const handleSendEdit = async () => {
    if (!editingContent.trim() || !editingMessageId || !currentSessionId) return

    // Find the message being edited
    const messageIndex = messages.findIndex((msg) => msg.id === editingMessageId)
    if (messageIndex === -1) return

    // Store content before clearing state and calculate messages to keep
    const newContent = editingContent.trim()
    const messagesToKeep = messages.slice(0, messageIndex)

    // Clear editing state immediately for better UX
    setEditingMessageId(null)
    setEditingContent('')

    // Immediately update UI to remove messages after the edited one
    const editedMessage: ChatMessage = {
      id: editingMessageId, // Will be updated with real ID after API call
      role: 'user',
      content: newContent,
      timestamp: new Date(),
    }
    setMessages([...messagesToKeep, editedMessage])

    // Start loading state immediately
    const controller = new AbortController()
    setAbortController(controller)
    setIsLoading(true)
    setIsThinking(true)
    setCurrentStreamContent('')
    setCurrentFunctionCalls([])
    setUniqueFunctionCalls(new Set())

    try {
      // Call edit API to update database
      const editResponse = await fetch(
        `/api/playground/sessions/${currentSessionId}/messages/${editingMessageId}/edit`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await apiClient.getToken()}`,
          },
          body: JSON.stringify({
            role: 'user',
            content: newContent,
            metadata: {},
          }),
        },
      )

      if (!editResponse.ok) {
        throw new Error(`Failed to edit message: ${editResponse.status}`)
      }

      const editedMessageData = await editResponse.json()

      // Update message with real database ID
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessageId
            ? { ...msg, id: editedMessageData.id, timestamp: new Date(editedMessageData.created_at) }
            : msg,
        ),
      )
    } catch (error) {
      console.error('Error editing message:', error)
      setIsLoading(false)
      setIsThinking(false)
      setAbortController(null)
      return
    }

    try {
      const requestData = {
        messages: [
          ...messagesToKeep.map((msg) => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: newContent },
        ],
        system_message: systemMessage || undefined,
        max_tokens: chatSettings.maxTokens,
        temperature: chatSettings.temperature,
        top_p: chatSettings.topP,
        frequency_penalty: chatSettings.frequencyPenalty,
        presence_penalty: chatSettings.presencePenalty,
        function_calling: chatSettings.functionCalling,
      }

      const response = await fetch('/api/ai/chat/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await apiClient.getToken()}`,
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let assistantMessage = ''
      let allFunctionCalls: FunctionCall[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setIsThinking(false)
              continue
            }

            try {
              const parsed: StreamChunk = JSON.parse(data)

              if (parsed.content) {
                assistantMessage += parsed.content
                setCurrentStreamContent(assistantMessage)
                setIsThinking(false)
              }

              if (parsed.function_calls && parsed.function_calls.length > 0) {
                const newFunctionCalls = parsed.function_calls.filter((call) => {
                  const callId = `${call.name}-${JSON.stringify(call.arguments)}`
                  if (uniqueFunctionCalls.has(callId)) {
                    return false
                  }
                  uniqueFunctionCalls.add(callId)
                  return true
                })

                if (newFunctionCalls.length > 0) {
                  allFunctionCalls = [...allFunctionCalls, ...newFunctionCalls]
                  setCurrentFunctionCalls(allFunctionCalls)
                  setUniqueFunctionCalls(new Set(uniqueFunctionCalls))
                  setIsThinking(true)
                }
              }

              if (parsed.finish_reason === 'tool_calls') {
                setIsThinking(true)
                continue
              }

              if (parsed.finish_reason === 'stop' || parsed.finish_reason === 'completed') {
                setIsThinking(false)
              }

              if (parsed.finish_reason === 'content_filter') {
                setIsThinking(false)
              }

              if (parsed.finish_reason === 'error') {
                setIsThinking(false)
                break
              }
            } catch (e) {
              console.error('Error parsing chunk:', e)
              console.error('Chunk data:', data)
            }
          }
        }
      }

      // Add final assistant message
      const finalMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
        functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
      }

      setMessages((prev) => [...prev, finalMessage])
      setCurrentStreamContent('')
      setCurrentFunctionCalls([])
      setUniqueFunctionCalls(new Set())

      // Save assistant message to database and update with real ID
      if (currentSessionId) {
        const savedAssistantMessage = await saveMessage(currentSessionId, 'assistant', assistantMessage, {
          functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
        })
        if (savedAssistantMessage) {
          // Update the message with the real database ID
          setMessages((prev) =>
            prev.map((msg) => (msg.id === finalMessage.id ? { ...msg, id: savedAssistantMessage.id } : msg)),
          )
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      console.error('Error in chat completion:', error)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setCreatedNewSession(false)
      setIsThinking(false)
      setAbortController(null)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    setIsDeleting(true)
    try {
      // Optimistically remove from UI first for better performance
      if (sidebarRef.current) {
        sidebarRef.current.removeSession(sessionId)
      }

      // If deleting current session, start a new chat
      if (sessionId === currentSessionId) {
        handleNewChat()
      }

      // Call API to delete from backend
      const response = await fetch(`/api/playground/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${await apiClient.getToken()}`,
        },
      })

      if (!response.ok) {
        console.error('Failed to delete session')
        // Reload sessions to restore state if deletion failed
        if (sidebarRef.current) {
          sidebarRef.current.refreshSessions()
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      // Reload sessions to restore state if deletion failed
      if (sidebarRef.current) {
        sidebarRef.current.refreshSessions()
      }
    } finally {
      setIsDeleting(false)
      setDeleteSessionId(null)
    }
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Chat History Sidebar - Hidden on mobile */}
      {!isMobile && (
        <ChatHistorySidebar
          ref={sidebarRef}
          currentSessionId={currentSessionId}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          onDeleteSession={(sessionId) => setDeleteSessionId(sessionId)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {isLoadingSession && !createdNewSession && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading session...</span>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <MessageComponent
              key={message.id}
              message={message}
              isEditing={editingMessageId === message.id}
              editingContent={editingContent}
              onEditingContentChange={setEditingContent}
              onEdit={handleEditMessage}
              onCancelEdit={handleCancelEdit}
              onSendEdit={handleSendEdit}
              isLoading={isLoading}
            />
          ))}

          {/* Current streaming message */}
          {(currentStreamContent || isThinking) && (
            <div className="flex items-start gap-2 justify-start">
              {/* Bot icon - left side, aligned to top */}
              <Bot className="w-4 h-4 text-muted-foreground self-start mt-1 flex-shrink-0" />
              <div className="bg-muted/70 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  {isThinking && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      <span className="text-xs text-muted-foreground">thinking...</span>
                    </div>
                  )}
                </div>
                {currentStreamContent && <MarkdownContent content={currentStreamContent} />}
                {currentFunctionCalls.length > 0 && <FunctionCallsDisplay functionCalls={currentFunctionCalls} />}
                {isLoading && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce animation-delay-75" />
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce animation-delay-150" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t p-4">
          {/* Mobile buttons row */}
          {isMobile && (
            <div className="flex gap-2 mb-3">
              <Button onClick={handleNewChat} variant="outline" size="sm" className="flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4" />
                New Chat
              </Button>
              <Button
                onClick={() => setIsHistoryOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2">
                <History className="w-4 h-4" />
                History
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => setIsSettingsOpen(true)} variant="outline" size="sm" className="self-end">
              <Settings className="w-4 h-4" />
            </Button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const newValue = e.target.value
                setInput(newValue)
                adjustTextareaHeight(newValue)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              className="flex-1 p-1 border border-input rounded-md resize-none leading-5"
              rows={textareaRows}
              placeholder="Type your message... (Shift+Enter for new line)"
              disabled={isLoading}
            />
            <Button
              onClick={isLoading ? abortMessage : sendMessage}
              disabled={!isLoading && !input.trim()}
              size="sm"
              className="self-end">
              {isAborting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLoading ? (
                <Square className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <ChatSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        systemMessage={systemMessage}
        onSystemMessageChange={setSystemMessage}
        settings={chatSettings}
        onSettingsChange={setChatSettings}
        onClearChat={clearMessages}
      />

      {/* Mobile Chat History Sheet */}
      {isMobile && (
        <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <SheetContent side="left" className="w-full sm:w-80 p-0">
            <div className="flex flex-col h-full">
              <SheetHeader className="px-6 py-4 border-b">
                <SheetTitle>Chat History</SheetTitle>
                <SheetDescription>Browse your previous chat conversations and start a new chat.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-hidden">
                <MobileChatHistory
                  ref={sidebarRef}
                  currentSessionId={currentSessionId}
                  onSessionSelect={(sessionId) => {
                    handleSessionSelect(sessionId)
                    setIsHistoryOpen(false)
                  }}
                  onNewChat={() => {
                    handleNewChat()
                    setIsHistoryOpen(false)
                  }}
                  onDeleteSession={(sessionId) => {
                    setIsHistoryOpen(false)
                    setDeleteSessionId(sessionId)
                  }}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteSessionId} onOpenChange={() => !isDeleting && setDeleteSessionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteSessionId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteSessionId && handleDeleteSession(deleteSessionId)}
              disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const MobileChatHistory = forwardRef<ChatHistorySidebarRef, ChatHistorySidebarProps>(
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

    const removeSession = useCallback((sessionId: string) => {
      setSessions((prev) => prev.filter((session) => session.id !== sessionId))
    }, [])

    const refreshSessions = useCallback(() => {
      loadSessions()
    }, [loadSessions])

    useImperativeHandle(ref, () => ({
      addNewSession: (session: ChatSession) => {
        setSessions((prev) => [session, ...prev])
      },
      updateSessionTitle: (sessionId: string, title: string) => {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)))
      },
      removeSession,
      refreshSessions,
    }))

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
      return title.length > 40 ? `${title.slice(0, 40)}...` : title
    }

    if (isLoading) {
      return (
        <div className="p-4 space-y-2">
          <div className="h-8 bg-muted animate-pulse rounded" />
          <div className="h-6 bg-muted animate-pulse rounded" />
          <div className="h-6 bg-muted animate-pulse rounded" />
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full">
        {/* New Chat Button */}
        <div className="p-4 border-b">
          <Button onClick={onNewChat} className="w-full justify-start gap-2" variant="outline">
            <MessageSquarePlus className="w-4 h-4" />
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
                  <button
                    type="button"
                    className="w-full p-3 cursor-pointer text-left relative"
                    onClick={() => onSessionSelect(session.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      onDeleteSession?.(session.id)
                    }}
                    onTouchStart={() => {
                      const timer = setTimeout(() => {
                        onDeleteSession?.(session.id)
                      }, 800)

                      const clearTimer = () => {
                        clearTimeout(timer)
                        document.removeEventListener('touchend', clearTimer)
                        document.removeEventListener('touchmove', clearTimer)
                      }

                      document.addEventListener('touchend', clearTimer)
                      document.addEventListener('touchmove', clearTimer)
                    }}>
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

MobileChatHistory.displayName = 'MobileChatHistory'

interface ChatHistorySidebarProps {
  currentSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onNewChat: () => void
  onDeleteSession?: (sessionId: string) => void
}

interface ChatSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  systemMessage: string
  onSystemMessageChange: (value: string) => void
  settings: {
    maxTokens: number
    temperature: number
    topP: number
    frequencyPenalty: number
    presencePenalty: number
    functionCalling: boolean
  }
  onSettingsChange: (settings: {
    maxTokens: number
    temperature: number
    topP: number
    frequencyPenalty: number
    presencePenalty: number
    functionCalling: boolean
  }) => void
  onClearChat: () => void
}

function ChatSettingsModal({
  isOpen,
  onClose,
  systemMessage,
  onSystemMessageChange,
  settings,
  onSettingsChange,
  onClearChat,
}: ChatSettingsModalProps) {
  const handleSettingChange = (key: string, value: number | boolean) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    })
  }

  const handleClearChat = () => {
    onClearChat()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
          <DialogDescription>Configure system message and model parameters for your chat experience.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* System Message */}
          <div className="space-y-2">
            <Label htmlFor="system-message">System Message</Label>
            <Textarea
              id="system-message"
              value={systemMessage}
              onChange={(e) => onSystemMessageChange(e.target.value)}
              className="min-h-[100px]"
              placeholder="You are a helpful assistant."
            />
          </div>

          {/* Model Parameters */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Model Parameters</h3>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label>Max Tokens: {settings.maxTokens}</Label>
              <Slider
                value={[settings.maxTokens]}
                onValueChange={([value]) => handleSettingChange('maxTokens', value)}
                max={4000}
                min={100}
                step={100}
                className="w-full"
              />
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <Label>Temperature: {settings.temperature}</Label>
              <Slider
                value={[settings.temperature]}
                onValueChange={([value]) => handleSettingChange('temperature', value)}
                max={2.0}
                min={0.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Top P */}
            <div className="space-y-2">
              <Label>Top P: {settings.topP}</Label>
              <Slider
                value={[settings.topP]}
                onValueChange={([value]) => handleSettingChange('topP', value)}
                max={1.0}
                min={0.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Frequency Penalty */}
            <div className="space-y-2">
              <Label>Frequency Penalty: {settings.frequencyPenalty}</Label>
              <Slider
                value={[settings.frequencyPenalty]}
                onValueChange={([value]) => handleSettingChange('frequencyPenalty', value)}
                max={2.0}
                min={-2.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Presence Penalty */}
            <div className="space-y-2">
              <Label>Presence Penalty: {settings.presencePenalty}</Label>
              <Slider
                value={[settings.presencePenalty]}
                onValueChange={([value]) => handleSettingChange('presencePenalty', value)}
                max={2.0}
                min={-2.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Function Calling */}
            <div className="flex items-center space-x-2">
              <Switch
                id="function-calling"
                checked={settings.functionCalling}
                onCheckedChange={(checked) => handleSettingChange('functionCalling', checked)}
              />
              <Label htmlFor="function-calling">Enable Function Calling</Label>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-medium">Actions</h3>
            <Button onClick={handleClearChat} variant="destructive" className="w-full">
              Clear Chat History
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface MessageComponentProps {
  message: ChatMessage
  isEditing: boolean
  editingContent: string
  onEditingContentChange: (content: string) => void
  onEdit: (messageId: string, content: string) => void
  onCancelEdit: () => void
  onSendEdit: () => void
  isLoading: boolean
}

function MessageComponent({
  message,
  isEditing,
  editingContent,
  onEditingContentChange,
  onEdit,
  onCancelEdit,
  onSendEdit,
  isLoading,
}: MessageComponentProps) {
  const isUser = message.role === 'user'

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  if (isUser) {
    return (
      <div className="flex items-start gap-2 justify-end">
        <div className="flex flex-col items-end">
          {/* Message Content with time stamp */}
          <div className="flex items-end gap-1">
            {/* Time stamp - left of message, aligned to bottom */}
            <span className="text-xs text-muted-foreground pb-1 flex-shrink-0">
              {message.timestamp.toLocaleTimeString()}
            </span>

            {isEditing ? (
              /* Editing Mode */
              <div className="max-w-[80vw] rounded-lg p-4 bg-slate-800 text-white">
                <Textarea
                  value={editingContent}
                  onChange={(e) => onEditingContentChange(e.target.value)}
                  className="w-full min-h-[60px] bg-slate-700 border-slate-600 text-white resize-none"
                  placeholder="Edit your message..."
                />
                <div className="flex gap-2 mt-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelEdit}
                    disabled={isLoading}
                    className="text-slate-400 border-slate-600 hover:bg-slate-700">
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={onSendEdit}
                    disabled={isLoading || !editingContent.trim()}
                    className="bg-blue-600 hover:bg-blue-700">
                    <Send className="w-3 h-3 mr-1" />
                    Send
                  </Button>
                </div>
              </div>
            ) : (
              /* Normal Display Mode */
              <div className="max-w-[80vw] rounded-lg p-4 bg-slate-800 text-white break-all">
                <div className="text-sm whitespace-pre-wrap break-all overflow-wrap-anywhere">{message.content}</div>
              </div>
            )}
          </div>

          {/* Action Buttons - positioned under message box */}
          {!isEditing && (
            <div className="flex gap-1 mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto transition-all duration-200 opacity-30 hover:opacity-80 text-muted-foreground hover:bg-background/50"
                style={{ padding: 'inherit' }}
                onClick={() => onEdit(message.id, message.content)}
                disabled={isLoading}>
                <Edit3 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto transition-all duration-200 opacity-30 hover:opacity-80 text-muted-foreground hover:bg-background/50"
                style={{ padding: 'inherit' }}
                onClick={copyToClipboard}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* User icon - right side, aligned to top */}
        <User className="w-4 h-4 text-muted-foreground self-start mt-1 flex-shrink-0" />
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex items-start gap-2 justify-start">
      {/* Bot icon - left side, aligned to top */}
      <Bot className="w-4 h-4 text-muted-foreground self-start mt-1 flex-shrink-0" />

      <div className="flex flex-col items-start">
        {/* Message Content with time stamp */}
        <div className="flex items-end gap-1">
          <div className="max-w-[80vw] rounded-lg p-4 bg-muted/70 break-all">
            <MarkdownContent content={message.content} />
            {message.functionCalls && message.functionCalls.length > 0 && (
              <FunctionCallsDisplay functionCalls={message.functionCalls} />
            )}
          </div>
          {/* Time stamp - right of message, aligned to bottom */}
          <span className="text-xs text-muted-foreground pb-1 flex-shrink-0">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>

        {/* Copy Button - positioned under message box */}
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-auto mt-1 transition-all duration-200 opacity-30 hover:opacity-80 text-muted-foreground hover:bg-background/50"
          onClick={copyToClipboard}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

function ResultViewer({ result }: { result: unknown }) {
  const [viewMode, setViewMode] = useState<'auto' | 'raw' | 'json'>('auto')

  // Determine if result should be displayed as JSON
  const shouldShowAsJson = () => {
    if (typeof result === 'string') {
      return isJsonString(result)
    }
    return isJsonObject(result) || Array.isArray(result)
  }

  const getFormattedResult = () => {
    if (viewMode === 'raw') {
      return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    }

    if (viewMode === 'json' || (viewMode === 'auto' && shouldShowAsJson())) {
      try {
        if (typeof result === 'string') {
          const parsed = JSON.parse(result)
          return JSON.stringify(parsed, null, 2)
        }
        return JSON.stringify(result, null, 2)
      } catch {
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      }
    }

    return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  }

  const isJsonView = viewMode === 'json' || (viewMode === 'auto' && shouldShowAsJson())

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium text-muted-foreground">Result:</div>
        {shouldShowAsJson() && (
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === 'auto' ? 'default' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode('auto')}>
              Auto
            </Button>
            <Button
              variant={viewMode === 'json' ? 'default' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode('json')}>
              <Code2 className="w-3 h-3 mr-1" />
              JSON
            </Button>
            <Button
              variant={viewMode === 'raw' ? 'default' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode('raw')}>
              <FileText className="w-3 h-3 mr-1" />
              Raw
            </Button>
          </div>
        )}
      </div>
      <div
        className={`text-xs p-2 rounded overflow-x-auto border ${
          isJsonView ? 'bg-slate-900 text-green-400 font-mono' : 'bg-muted/50'
        }`}>
        <pre className="whitespace-pre-wrap">{getFormattedResult()}</pre>
      </div>
    </div>
  )
}

function FunctionCallsDisplay({ functionCalls }: { functionCalls: FunctionCall[] }) {
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set())

  const toggleExpanded = (callId: string) => {
    const newExpanded = new Set(expandedCalls)
    if (newExpanded.has(callId)) {
      newExpanded.delete(callId)
    } else {
      newExpanded.add(callId)
    }
    setExpandedCalls(newExpanded)
  }

  return (
    <div className="mt-3 p-3 bg-background/50 rounded border">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium">Tool Usage</span>
        <span className="text-xs text-muted-foreground">
          ({functionCalls.length} tool{functionCalls.length !== 1 ? 's' : ''})
        </span>
      </div>
      <div className="space-y-2">
        {functionCalls.map((call) => {
          const callId = `${call.name}-${JSON.stringify(call.arguments)}`
          const isExpanded = expandedCalls.has(callId)

          return (
            <div key={callId} className="bg-background/50 rounded border">
              <Button
                variant="ghost"
                className="w-full justify-between p-2 h-auto text-left"
                onClick={() => toggleExpanded(callId)}>
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-blue-500" />
                  <span className="font-medium text-blue-600 text-sm">{call.name}</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>

              {isExpanded && (
                <div className="px-2 pb-2 space-y-2">
                  {Object.keys(call.arguments).length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Arguments:</div>
                      <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto border">
                        {JSON.stringify(call.arguments, null, 2)}
                      </pre>
                    </div>
                  )}
                  {call.result != null && <ResultViewer result={call.result} />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
