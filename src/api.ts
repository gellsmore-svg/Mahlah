import type { AskResponse, TraceEvent } from './types'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function askTirzah(params: {
  query: string
  sessionId: string
  model?: string
  retrievalMode?: string
}): Promise<AskResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      query: params.query,
      session_id: params.sessionId,
      model: params.model || undefined,
      retrieval_mode: params.retrievalMode || undefined,
    }),
  })
  if (!res.ok) {
    throw new Error(`Tirzah /api/ask failed: ${res.status}`)
  }
  return (await res.json()) as AskResponse
}

export async function submitFeedback(params: {
  text: string
  sessionId: string
  traceId?: string
  messageId?: string
  kind?: string
  source?: string
}): Promise<{ ok: boolean; feedbackId: string }> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      text: params.text,
      session_id: params.sessionId,
      trace_id: params.traceId,
      message_id: params.messageId,
      kind: params.kind,
      source: params.source ?? 'user',
    }),
  })
  return res.json()
}

/**
 * Subscribe to the live process/log stream for a session or trace.
 * Tirzah emits unnamed data-only SSE frames whose payload is a TraceEvent.
 * Returns the EventSource so the caller can `.close()` it.
 */
export function openTraceStream(
  params: { sessionId?: string; traceId?: string },
  onEvent: (event: TraceEvent) => void,
): EventSource {
  const q = new URLSearchParams()
  if (params.traceId) q.set('trace_id', params.traceId)
  if (params.sessionId) q.set('session_id', params.sessionId)
  const source = new EventSource(`/api/trace/stream?${q.toString()}`)
  source.onmessage = (event) => {
    if (!event.data) return
    try {
      onEvent(JSON.parse(event.data) as TraceEvent)
    } catch {
      /* keepalive / comment frame — ignore */
    }
  }
  return source
}
