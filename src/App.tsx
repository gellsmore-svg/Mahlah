import { useEffect, useMemo, useState } from 'react'
import ConversationSidebar from './components/ConversationSidebar'
import ChatWindow from './components/ChatWindow'
import PromptComposer from './components/PromptComposer'
import ProcessPanel from './components/ProcessPanel'
import FeedbackPanel from './components/FeedbackPanel'
import { askTirzah, fetchRuntime, openTraceStream } from './api'
import type { ChatMessage, Conversation, ModelOption, TraceEvent } from './types'

const STORAGE_KEY = 'mahlah.conversations.v1'

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function deriveTitle(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, ' ')
  if (!cleaned) return 'New chat'
  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}…` : cleaned
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Conversation[]) : []
  } catch {
    return []
  }
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const [activeId, setActiveId] = useState<string | null>(() => loadConversations()[0]?.id ?? null)
  const [processEvents, setProcessEvents] = useState<TraceEvent[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [adapters, setAdapters] = useState<string[]>(['mock', 'ollama_http', 'ollama_cli'])
  const [modes, setModes] = useState<string[]>(['direct', 'agentic', 'deep'])
  const [model, setModel] = useState('')
  const [adapter, setAdapter] = useState('')
  const [mode, setMode] = useState('direct')
  const [collapsed, setCollapsed] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  }, [conversations])

  // Populate model / adapter / retrieval-mode options from the live backend so
  // the UI never offers models that aren't installed.
  useEffect(() => {
    fetchRuntime()
      .then((runtime) => {
        if (runtime.model_options?.length) setModels(runtime.model_options)
        if (runtime.available_adapters?.length) setAdapters(runtime.available_adapters)
        if (runtime.available_retrieval_modes?.length) setModes(runtime.available_retrieval_modes)
        setModel(runtime.default_model || runtime.model_options?.[0]?.name || '')
        setAdapter(runtime.default_adapter || '')
        if (runtime.retrieval_mode) setMode(runtime.retrieval_mode)
      })
      .catch(() => {
        /* backend not reachable yet — keep sensible fallbacks */
      })
  }, [])

  const active = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [conversations, activeId],
  )
  const messages = active?.messages ?? []

  const updateConversation = (id: string, fn: (conversation: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((conversation) => (conversation.id === id ? fn(conversation) : conversation)))
  }

  const newChat = (): string => {
    const conversation: Conversation = { id: uid('sess'), title: 'New chat', createdAt: Date.now(), messages: [] }
    setConversations((prev) => [conversation, ...prev])
    setActiveId(conversation.id)
    setProcessEvents([])
    return conversation.id
  }

  const handleSend = async (text: string) => {
    let sessionId = activeId
    if (!sessionId || !conversations.some((conversation) => conversation.id === sessionId)) {
      sessionId = newChat()
    }
    const userMessage: ChatMessage = { id: uid('u'), role: 'user', text }
    const assistantMessage: ChatMessage = { id: uid('a'), role: 'assistant', text: '', pending: true }

    updateConversation(sessionId, (conversation) => ({
      ...conversation,
      title: conversation.messages.length === 0 ? deriveTitle(text) : conversation.title,
      messages: [...conversation.messages, userMessage, assistantMessage],
    }))
    setSending(true)
    setProcessEvents([])

    // Live process stream for THIS request (no replay → only the new steps),
    // so the panel fills in as the backend works rather than only at the end.
    const stream = openTraceStream({ sessionId, replay: false }, (event) => {
      setProcessEvents((prev) =>
        prev.some((existing) => existing.event_id === event.event_id)
          ? prev
          : [...prev, event].sort((a, b) => a.seq - b.seq),
      )
    })

    try {
      const response = await askTirzah({ query: text, sessionId, model, adapter, retrievalMode: mode })
      setProcessEvents(response.processEvents ?? [])
      updateConversation(sessionId, (conversation) => ({
        ...conversation,
        lastTraceId: response.traceId,
        messages: conversation.messages.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, text: response.answer || '(empty answer)', pending: false, traceId: response.traceId }
            : message,
        ),
      }))
    } catch (error) {
      updateConversation(sessionId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, text: `Request failed: ${(error as Error).message}`, pending: false, error: true }
            : message,
        ),
      }))
    } finally {
      stream.close()
      setSending(false)
    }
  }

  const renameConversation = (id: string, title: string) => {
    const cleaned = title.trim()
    if (!cleaned) return
    updateConversation(id, (conversation) => ({ ...conversation, title: cleaned }))
  }

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((conversation) => conversation.id !== id))
    if (activeId === id) {
      setActiveId(null)
      setProcessEvents([])
    }
  }

  const openDevLog = () => {
    if (!activeId) return
    const url = `${window.location.pathname}?view=devlog&session=${encodeURIComponent(activeId)}`
    window.open(url, `mahlah-devlog-${activeId}`, 'width=660,height=840')
  }

  return (
    <div className="app">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        collapsed={collapsed}
        onSelect={(id) => {
          setActiveId(id)
          setProcessEvents([])
        }}
        onNewChat={newChat}
        onToggle={() => setCollapsed((value) => !value)}
        onRename={renameConversation}
        onDelete={deleteConversation}
      />
      <main className="main">
        <ChatWindow messages={messages} />
        <PromptComposer
          disabled={sending}
          models={models}
          adapters={adapters}
          modes={modes}
          model={model}
          adapter={adapter}
          mode={mode}
          onModelChange={setModel}
          onAdapterChange={setAdapter}
          onModeChange={setMode}
          onSend={handleSend}
        />
      </main>
      <ProcessPanel
        events={processEvents}
        streaming={sending}
        onOpenDevLog={activeId ? openDevLog : undefined}
        onOpenFeedback={activeId ? () => setFeedbackOpen(true) : undefined}
      />
      <FeedbackPanel
        open={feedbackOpen}
        sessionId={activeId}
        traceId={active?.lastTraceId}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  )
}
