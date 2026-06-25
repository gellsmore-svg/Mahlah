import { useState } from 'react'
import { submitFeedback } from '../api'

interface Props {
  open: boolean
  sessionId: string | null
  traceId?: string
  onClose: () => void
}

const KINDS = ['idea', 'bug', 'ui', 'reasoning', 'other']

type Status = 'idle' | 'sending' | 'done' | 'error'

export default function FeedbackPanel({ open, sessionId, traceId, onClose }: Props) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState('idea')
  const [status, setStatus] = useState<Status>('idle')

  if (!open) return null

  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed || !sessionId) return
    setStatus('sending')
    try {
      await submitFeedback({ text: trimmed, sessionId, traceId, kind, source: 'user' })
      setStatus('done')
      setText('')
      window.setTimeout(onClose, 900)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <strong>Feedback</strong>
          <button className="icon-btn" title="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted modal__hint">
          Attached to the current conversation{traceId ? ' and last answer' : ''}. Bugs, UI issues,
          reasoning problems, or ideas — anything goes.
        </p>
        <textarea
          className="modal__textarea"
          placeholder="What did you notice?"
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />
        <div className="modal__row">
          <select className="model-select" value={kind} onChange={(event) => setKind(event.target.value)}>
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className="modal__actions">
            {status === 'done' && <span className="muted">Saved ✓</span>}
            {status === 'error' && <span className="feedback-error">Failed — try again</span>}
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={!text.trim() || !sessionId || status === 'sending'}
            >
              {status === 'sending' ? 'Saving…' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
