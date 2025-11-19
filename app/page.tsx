'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { ChatMessage, BrandonAsset } from '@/lib/types'
import { AssetCard } from '@/components/asset-card'
import { ThinkingIndicator } from '@/components/thinking-indicator'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { LogOut, Trash2, Send } from 'lucide-react'

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  // Check authentication and load chat history
  useEffect(() => {
    checkAuth()
    loadChatHistory()
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom()
  }, [messages, isThinking])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData) {
      setUserRole(roleData.role as 'admin' | 'user')
    }
  }

  async function loadChatHistory() {
    setIsLoadingHistory(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/history', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  async function handleClearHistory() {
    if (!confirm('Are you sure you want to clear your chat history?')) {
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const response = await fetch('/api/history', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        setMessages([])
      }
    } catch (error) {
      console.error('Error clearing history:', error)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setIsLoading(true)
    setIsThinking(true)
    setStatusMessage('Sending message...')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      // Optimistically add user message
      const optimisticUserMessage: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: session.user.id,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, optimisticUserMessage])

      // Call chat API with EventSource-like handling
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let assistantMessage = ''
      let assets: BrandonAsset[] = []

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n')

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue

          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'status') {
              setStatusMessage(data.data.status)
            } else if (data.type === 'result') {
              assistantMessage = data.data.assistant_message
              assets = data.data.assets || []
              setIsThinking(false)
            } else if (data.type === 'error') {
              throw new Error(data.data.error)
            }
          } catch (parseError) {
            console.error('Error parsing SSE data:', parseError)
          }
        }
      }

      // Add assistant message to UI
      const assistantMessageObj: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: session.user.id,
        role: 'assistant',
        content: assistantMessage,
        assets,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessageObj])
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(error.message || 'Failed to send message. Please try again.')
    } finally {
      setIsLoading(false)
      setIsThinking(false)
      setStatusMessage('')
    }
  }

  if (isLoadingHistory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Brandon</h1>
            {userRole === 'admin' && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/ingest')}
              >
                Ingest Assets
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleClearHistory}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear History
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-2">
                Welcome to Brandon
              </h2>
              <p className="text-muted-foreground">
                Your AI-powered brand asset assistant. Ask me to find images
                from your DAM.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="mb-6">
              {message.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-2xl">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="bg-muted rounded-lg px-4 py-2 max-w-2xl">
                    {message.content}
                  </div>
                  {message.assets && message.assets.length > 0 && (
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {message.assets.map((asset) => (
                        <AssetCard key={asset.id} asset={asset} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isThinking && <ThinkingIndicator status={statusMessage} />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-card">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              placeholder="Ask me to find brand assets..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              disabled={isLoading}
              className="min-h-[60px] resize-none"
            />
            <Button type="submit" disabled={isLoading || !inputValue.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
