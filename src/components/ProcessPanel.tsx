import type { TraceEvent } from '../types'

interface Props {
  events: TraceEvent[]
  streaming: boolean
  onOpenDevLog?: () => void
  onOpenFeedback?: () => void
}

const STATUS_DOT: Record<string, string> = {
  started: 'dot--started',
  ok: 'dot--ok',
  completed: 'dot--ok',
  failed: 'dot--failed',
}

export default function ProcessPanel({ events, streaming, onOpenDevLog, onOpenFeedback }: Props) {
  return (
    <aside className="process">
      <div className="process__head">
        <span>Process</span>
        <span className="process__head-right">
          {streaming && <span className="live">● live</span>}
          {onOpenFeedback && (
            <button className="icon-btn" title="Send feedback about this conversation" onClick={onOpenFeedback}>
              ⚑
            </button>
          )}
          {onOpenDevLog && (
            <button className="icon-btn" title="Open live dev log in a new window" onClick={onOpenDevLog}>
              ⤢
            </button>
          )}
        </span>
      </div>
      <div className="process__list">
        {events.length === 0 && (
          <p className="muted process__empty">
            Process steps for the current request appear here — separate from the answer.
          </p>
        )}
        {events.map((event) => (
          <div key={event.event_id} className="event">
            <span className={`dot ${STATUS_DOT[event.status] ?? 'dot--ok'}`} />
            <div className="event__body">
              <div className="event__summary">{event.summary || event.type}</div>
              <div className="event__type muted">
                {event.type}
                {event.status !== 'ok' ? ` · ${event.status}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
