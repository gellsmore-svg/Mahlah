import { useEffect, useMemo, useRef, useState } from 'react'
import { openTraceStream } from './api'
import type { TraceEvent } from './types'

function sortEvents(events: TraceEvent[]): TraceEvent[] {
  return [...events].sort((a, b) => {
    if (a.timestamp === b.timestamp) return a.seq - b.seq
    return a.timestamp < b.timestamp ? -1 : 1
  })
}

/**
 * Standalone, live dev/system-log view — opened in its own window/tab from a
 * conversation. Subscribes with replay=true (history + live) and shows the full
 * structured lifecycle of the session/trace, suitable for a developer or a
 * browser-based AI assistant to watch.
 */
export default function DevLogView() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const sessionId = query.get('session') ?? undefined
  const traceId = query.get('trace') ?? undefined

  const [events, setEvents] = useState<TraceEvent[]>([])
  const [live, setLive] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId && !traceId) return
    const stream = openTraceStream({ sessionId, traceId, replay: true }, (event) => {
      setLive(true)
      setEvents((prev) =>
        prev.some((existing) => existing.event_id === event.event_id) ? prev : sortEvents([...prev, event]),
      )
    })
    return () => stream.close()
  }, [sessionId, traceId])

  useEffect(() => {
    endRef.current?.scrollIntoView()
  }, [events])

  const copyAll = () => {
    void navigator.clipboard?.writeText(JSON.stringify(events, null, 2))
  }

  const scope = traceId ? `trace ${traceId}` : sessionId ? `session ${sessionId}` : 'no session/trace'

  return (
    <div className="devlog">
      <header className="devlog__head">
        <div>
          <strong>Dev log</strong> <span className="muted devlog__scope">{scope}</span>
        </div>
        <div className="devlog__actions">
          {live && <span className="live">● live</span>}
          <button className="icon-btn" title="Copy all events as JSON" onClick={copyAll}>
            ⧉
          </button>
        </div>
      </header>

      <div className="devlog__body">
        {events.length === 0 && (
          <p className="muted devlog__empty">
            Waiting for events… open this from a conversation and ask something. Full request
            lifecycle (history + live) appears here.
          </p>
        )}
        {events.map((event) => (
          <div key={event.event_id} className={`logrow logrow--${event.severity}`}>
            <div className="logrow__top">
              <span className="logrow__ts">{event.timestamp?.slice(11, 23)}</span>
              <span className={`badge badge--${event.status}`}>{event.status}</span>
              <span className="logrow__type">{event.type}</span>
              <span className="logrow__src muted">{event.source}</span>
            </div>
            <div className="logrow__summary">{event.summary}</div>
            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <pre className="logrow__meta">{JSON.stringify(event.metadata, null, 2)}</pre>
            )}
            <div className="logrow__ids muted">
              {event.trace_id} · seq {event.seq}
              {event.message_id ? ` · ${event.message_id}` : ''}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
