import { useEffect, useState } from 'react'
import {
  completeProcessInstance,
  createProcessTemplate,
  fetchActiveProcess,
  fetchProcessTemplates,
  resolveProcessDeviation,
  resolveProcessGate,
  reviewProcess,
  startProcessInstance,
  suggestProcess,
} from '../api'
import type { ProcessReview } from '../api'
import { pendingApproval } from '../processLogic'
import type { ProcessInstance, ProcessTemplate } from '../types'

/**
 * The active-process control that sits above the composer: shows which
 * human-defined process the current conversation runs under, lets the operator
 * pick/start one (with a smart suggestion from the first message), surfaces
 * gate + deviation pauses for approval, and completes the instance. This is the
 * human-oversight surface for agentic work.
 */

interface Props {
  sessionId: string | null
  // The first user message — used to auto-suggest a fitting process.
  taskHint?: string
}

function errMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export default function ProcessBar({ sessionId, taskHint }: Props) {
  const [active, setActive] = useState<ProcessInstance | null>(null)
  const [templates, setTemplates] = useState<ProcessTemplate[]>([])
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState('')
  const [suggestReason, setSuggestReason] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBody, setNewBody] = useState('')
  const [review, setReview] = useState<ProcessReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    if (!sessionId) {
      setActive(null)
      return
    }
    fetchActiveProcess(sessionId)
      .then((instance) => {
        setActive(instance)
        // Only clear "load failed" style errors on a successful poll; keep
        // action errors until the next user action clears them.
      })
      .catch((err: unknown) => {
        setActive(null)
        setError(errMessage(err, 'Could not load active process'))
      })
  }

  useEffect(() => {
    fetchProcessTemplates()
      .then((list) => {
        setTemplates(list)
      })
      .catch((err: unknown) => {
        setTemplates([])
        setError(errMessage(err, 'Could not load process templates'))
      })
  }, [])

  useEffect(refresh, [sessionId])
  // Poll so gate/deviation pauses raised during a run appear without a reload.
  useEffect(() => {
    if (!sessionId) return
    const timer = setInterval(refresh, 4000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const start = async () => {
    if (!sessionId || !chosen || busy) return
    setBusy(true)
    setError(null)
    // If the operator kept the auto-suggestion, record it as such for the audit.
    const took = !!suggestReason && chosen !== ''
    try {
      const started = await startProcessInstance({
        template_id: chosen,
        task: taskHint?.trim() || 'Conversation work',
        sessionId,
        selection_reason: took ? 'suggested' : 'manual',
      })
      setActive(started)
      setPicking(false)
    } catch (err) {
      setError(errMessage(err, 'Failed to start process'))
    } finally {
      setBusy(false)
    }
  }

  const openPicker = async () => {
    setPicking(true)
    setError(null)
    // Smart auto-selection: suggest a fitting process from the first message.
    if (taskHint && taskHint.trim()) {
      try {
        const suggestion = await suggestProcess(taskHint)
        if (suggestion?.suggested_template_id) {
          setChosen(suggestion.suggested_template_id)
          setSuggestReason(`${suggestion.suggested_template_name} — ${suggestion.reason}`)
        }
      } catch (err) {
        setError(errMessage(err, 'Process suggestion failed'))
      }
    }
  }

  const create = async () => {
    if (!newName.trim() || !newBody.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const template = await createProcessTemplate({ name: newName, body: newBody })
      setTemplates((prev) => [template, ...prev])
      setChosen(template.template_id)
      setCreating(false)
      setNewName('')
      setNewBody('')
      setReview(null)
    } catch (err) {
      setError(errMessage(err, 'Failed to save process template'))
    } finally {
      setBusy(false)
    }
  }

  const runReview = async () => {
    if (!newBody.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await reviewProcess(newBody)
      if (!result) {
        setError('Process review returned no result')
        setReview(null)
      } else {
        setReview(result)
      }
    } catch (err) {
      setReview(null)
      setError(errMessage(err, 'Process review failed'))
    } finally {
      setBusy(false)
    }
  }

  const approve = async (approved: boolean) => {
    if (!active || busy) return
    const pend = pendingApproval(active)
    if (!pend) return
    setBusy(true)
    setError(null)
    try {
      const next =
        pend.kind === 'gate'
          ? await resolveProcessGate(active.instance_id, {
              step_id: pend.stepId ?? '',
              approved,
            })
          : await resolveProcessDeviation(active.instance_id, approved)
      setActive(next)
    } catch (err) {
      setError(errMessage(err, approved ? 'Approve failed' : 'Reject failed'))
    } finally {
      setBusy(false)
    }
  }

  const complete = async () => {
    if (!active || busy) return
    setBusy(true)
    setError(null)
    try {
      setActive(await completeProcessInstance(active.instance_id, 'completed'))
    } catch (err) {
      setError(errMessage(err, 'Failed to complete process'))
    } finally {
      setBusy(false)
    }
  }

  if (!sessionId) return null

  const pend = active ? pendingApproval(active) : null

  return (
    <div className="procbar">
      {error && (
        <div className="procbar__error" role="alert">
          ⚠ {error}
          <button
            type="button"
            className="procbar__link"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            dismiss
          </button>
        </div>
      )}

      {!active && !picking && (
        <button className="procbar__set" onClick={openPicker} disabled={busy}>
          + Set process
        </button>
      )}

      {!active && picking && (
        <div className="procbar__picker">
          <select
            value={chosen}
            onChange={(e) => {
              setChosen(e.target.value)
              setSuggestReason('')
            }}
            disabled={busy}
          >
            <option value="">choose a process…</option>
            {templates.map((t) => (
              <option key={t.template_id} value={t.template_id}>
                {t.name}
                {t.is_preset ? ' (preset)' : ''}
                {t.risk_level ? ` · ${t.risk_level}` : ''}
              </option>
            ))}
          </select>
          <button className="procbar__go" disabled={!chosen || busy} onClick={start}>
            {busy ? 'Starting…' : 'Start'}
          </button>
          <button className="procbar__link" onClick={() => setCreating((v) => !v)} disabled={busy}>
            {creating ? 'cancel' : 'new…'}
          </button>
          <button
            className="procbar__link"
            onClick={() => {
              setPicking(false)
              setSuggestReason('')
            }}
            disabled={busy}
          >
            close
          </button>
          {suggestReason && (
            <span className="procbar__suggest" title="Auto-suggested from your first message">
              ✦ suggested: {suggestReason}
            </span>
          )}
        </div>
      )}

      {creating && (
        <div className="procbar__create">
          <input
            placeholder="Process name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={busy}
          />
          <textarea
            placeholder="Describe the process in plain text — state its gates (e.g. 'pause for approval before shipping') and loops."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={4}
            disabled={busy}
          />
          {review && (
            <div className="procbar__review">
              {review.findings.length > 0 && (
                <ul className="procbar__findings">
                  {review.findings.map((f: ProcessReview['findings'][number], i: number) => (
                    <li key={i} className={`procbar__finding procbar__finding--${f.kind}`}>
                      <b>{f.kind.replace('_', ' ')}:</b> {f.note}
                    </li>
                  ))}
                </ul>
              )}
              {review.clarifying_questions.length > 0 && (
                <div className="procbar__questions">
                  <b>Tirzah asks:</b>
                  <ul>
                    {review.clarifying_questions.map((q: string, i: number) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.suggested_body && (
                <button
                  className="procbar__link"
                  onClick={() => setNewBody(review.suggested_body || '')}
                  disabled={busy}
                >
                  use Tirzah's suggested rewrite
                </button>
              )}
            </div>
          )}
          <div className="procbar__createbtns">
            <button className="procbar__link" onClick={runReview} disabled={busy || !newBody.trim()}>
              {busy ? 'Working…' : 'Review with Tirzah'}
            </button>
            <button
              className="procbar__go"
              onClick={create}
              disabled={busy || !newName.trim() || !newBody.trim()}
            >
              Save process
            </button>
          </div>
        </div>
      )}

      {active && (
        <div className={`procbar__active procbar__active--${active.status}`}>
          <span className="procbar__badge">{active.template_name}</span>
          <span className="procbar__status muted">{active.status.replace('_', ' ')}</span>
          {active.status !== 'completed' && active.status !== 'abandoned' && (
            <button className="procbar__link" onClick={complete} disabled={busy}>
              complete
            </button>
          )}
          {pend && (
            <div className="procbar__gate">
              <span className="procbar__gatetext">⏸ {pend.text}</span>
              <button className="procbar__approve" onClick={() => approve(true)} disabled={busy}>
                Approve
              </button>
              <button className="procbar__reject" onClick={() => approve(false)} disabled={busy}>
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
