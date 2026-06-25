// Mirrors Tirzah's trace event + /api/ask 3-channel contract.

export interface TraceEvent {
  event_id: string
  trace_id: string
  session_id: string
  type: string
  status: string
  summary: string
  severity: string
  source: string
  message_id: string | null
  request_id: string | null
  seq: number
  timestamp: string
  metadata: Record<string, unknown>
}

export interface AskResponse {
  ok?: boolean
  answer: string
  processEvents: TraceEvent[]
  traceId: string
  sessionId: string
  messageId: string
  requestId: string
  semantic_summary?: string
}

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  text: string
  traceId?: string
  pending?: boolean
  error?: boolean
}

export interface Conversation {
  id: string // == Tirzah session_id
  title: string
  createdAt: number
  messages: ChatMessage[]
  lastTraceId?: string
}
