import type { AskResponse, ProcessInstance, ProcessTemplate, Runtime, TraceEvent } from './types'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * The most useful message we can give for a failed response.
 *
 * Reading the body must not be able to throw. Calling `res.json()` inline meant
 * that when the body was NOT json — a proxy 502 returning HTML, or an empty
 * 500 — the parse error replaced the status, and the operator saw
 * "Unexpected token < in JSON at position 0" instead of "the backend is down".
 * That is the likeliest real failure, and it read like a client bug.
 */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    const detail = body?.detail
    return typeof detail === 'string' && detail.trim() ? detail : fallback
  } catch {
    return fallback // non-json body: the status is the signal that matters
  }
}

export async function fetchRuntime(): Promise<Runtime> {
  const res = await fetch('/api/runtime')
  if (!res.ok) throw new Error(`Tirzah /api/runtime failed: ${res.status}`)
  return (await res.json()) as Runtime
}

export async function askTirzah(params: {
  query: string
  sessionId: string
  model?: string
  adapter?: string
  retrievalMode?: string
}): Promise<AskResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      query: params.query,
      session_id: params.sessionId,
      model: params.model || undefined,
      adapter: params.adapter || undefined,
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
  if (!res.ok) throw new Error(`/api/feedback failed: ${res.status}`)
  return res.json()
}

/**
 * Subscribe to the live process/log stream for a session or trace.
 * Tirzah emits unnamed data-only SSE frames whose payload is a TraceEvent.
 * Returns the EventSource so the caller can `.close()` it.
 */
export function openTraceStream(
  params: { sessionId?: string; traceId?: string; replay?: boolean },
  onEvent: (event: TraceEvent) => void,
  onError?: (error: Event) => void,
): EventSource {
  const q = new URLSearchParams()
  if (params.traceId) q.set('trace_id', params.traceId)
  if (params.sessionId) q.set('session_id', params.sessionId)
  if (params.replay === false) q.set('replay', 'false')
  const source = new EventSource(`/api/trace/stream?${q.toString()}`)
  source.onmessage = (event) => {
    if (!event.data) return
    try {
      onEvent(JSON.parse(event.data) as TraceEvent)
    } catch {
      /* keepalive / comment frame — ignore */
    }
  }
  source.onerror = (error) => {
    // EventSource auto-reconnects on transient drops; surface the state so
    // panels can show "reconnecting…" instead of silently going stale.
    console.warn('trace stream error (readyState=%d)', source.readyState)
    onError?.(error)
  }
  return source
}

// --- Process management ---

export async function fetchProcessTemplates(): Promise<ProcessTemplate[]> {
  const res = await fetch('/api/process/templates')
  if (!res.ok) throw new Error(`/api/process/templates failed: ${res.status}`)
  return (await res.json()).templates ?? []
}

export async function createProcessTemplate(input: {
  name: string; body: string; description?: string; risk_level?: string; scope?: string
}): Promise<ProcessTemplate> {
  const res = await fetch('/api/process/templates', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `create template failed: ${res.status}`))
  return (await res.json()).template
}

export async function fetchActiveProcess(sessionId: string): Promise<ProcessInstance | null> {
  const res = await fetch(`/api/process/active?session_id=${encodeURIComponent(sessionId)}`)
  // 404 = no active process for this session (not an error).
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`/api/process/active failed: ${res.status}`)
  return (await res.json()).instance
}

export async function startProcessInstance(input: {
  template_id: string; task: string; sessionId: string; selection_reason?: string
}): Promise<ProcessInstance> {
  const res = await fetch('/api/process/instances', {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({
      template_id: input.template_id, task: input.task,
      session_id: input.sessionId, selection_reason: input.selection_reason ?? 'manual',
    }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `start process failed: ${res.status}`))
  return (await res.json()).instance
}

export async function resolveProcessGate(
  instanceId: string, input: { step_id: string; approved: boolean; note?: string },
): Promise<ProcessInstance> {
  const res = await fetch(`/api/process/instances/${instanceId}/gate`, {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `gate approval failed: ${res.status}`))
  return (await res.json()).instance
}

export async function resolveProcessDeviation(
  instanceId: string, approved: boolean, note?: string,
): Promise<ProcessInstance> {
  const res = await fetch(`/api/process/instances/${instanceId}/deviation/resolve`, {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ approved, note }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `deviation resolve failed: ${res.status}`))
  return (await res.json()).instance
}

export async function completeProcessInstance(
  instanceId: string, outcome: string,
): Promise<ProcessInstance> {
  const res = await fetch(`/api/process/instances/${instanceId}/complete`, {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ outcome }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `complete process failed: ${res.status}`))
  return (await res.json()).instance
}

export interface ProcessSuggestion {
  suggested_template_id: string | null
  suggested_template_name?: string
  reason: string
  method: string
  inferred_risk: string
  signals: string[]
  candidates: { template_id: string; name: string; score: number; reason: string }[]
}

export async function suggestProcess(task: string): Promise<ProcessSuggestion | null> {
  const res = await fetch('/api/process/suggest', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ task }),
  })
  if (!res.ok) throw new Error(`/api/process/suggest failed: ${res.status}`)
  return (await res.json()).suggestion ?? null
}

export interface ProcessReview {
  has_gates: boolean
  clarifying_questions: string[]
  findings: { kind: string; note: string; source?: string }[]
  suggested_body: string | null
  model_used: boolean
}

export async function reviewProcess(body: string, useModel = true): Promise<ProcessReview | null> {
  const res = await fetch('/api/process/review', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ body, use_model: useModel }),
  })
  if (!res.ok) throw new Error(`/api/process/review failed: ${res.status}`)
  return (await res.json()).review ?? null
}
