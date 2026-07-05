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

// The trace events that mean "waiting on you".
function pendingApproval(instance: ProcessInstance): { kind: 'gate' | 'deviation'; stepId?: string; text: string } | null {
  if (instance.status !== 'awaiting_gate') return null
  const last = [...instance.trace].reverse().find((e) =>
    e.event === 'process.gate.reached' || e.event === 'process.deviation.flagged',
  )
  if (!last) return { kind: 'gate', text: 'Paused for approval.' }
  if (last.event === 'process.deviation.flagged') {
    return { kind: 'deviation', text: `Deviation flagged: ${String(last.detail.description ?? '')}` }
  }
  return { kind: 'gate', stepId: String(last.detail.step_id ?? ''), text: `Gate at step ${String(last.detail.step_id ?? '?')}.` }
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

  const refresh = () => {
    if (!sessionId) {
      setActive(null)
      return
    }
    fetchActiveProcess(sessionId).then(setActive).catch(() => setActive(null))
  }

  useEffect(() => {
    fetchProcessTemplates().then(setTemplates).catch(() => setTemplates([]))
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
    if (!sessionId || !chosen) return
    // If the operator kept the auto-suggestion, record it as such for the audit.
    const took = !!suggestReason && chosen !== ''
    const started = await startProcessInstance({
      template_id: chosen,
      task: taskHint?.trim() || 'Conversation work',
      sessionId,
      selection_reason: took ? 'suggested' : 'manual',
    }).catch(() => null)
    if (started) {
      setActive(started)
      setPicking(false)
    }
  }

  const openPicker = async () => {
    setPicking(true)
    // Smart auto-selection: suggest a fitting process from the first message.
    if (taskHint && taskHint.trim()) {
      const suggestion = await suggestProcess(taskHint).catch(() => null)
      if (suggestion?.suggested_template_id) {
        setChosen(suggestion.suggested_template_id)
        setSuggestReason(`${suggestion.suggested_template_name} — ${suggestion.reason}`)
      }
    }
  }

  const create = async () => {
    if (!newName.trim() || !newBody.trim()) return
    const template = await createProcessTemplate({ name: newName, body: newBody }).catch(() => null)
    if (template) {
      setTemplates((prev) => [template, ...prev])
      setChosen(template.template_id)
      setCreating(false)
      setNewName('')
      setNewBody('')
      setReview(null)
    }
  }

  const runReview = async () => {
    if (!newBody.trim()) return
    setReview(await reviewProcess(newBody).catch(() => null))
  }

  const approve = async (approved: boolean) => {
    if (!active) return
    const pend = pendingApproval(active)
    if (!pend) return
    const next =
      pend.kind === 'gate'
        ? await resolveProcessGate(active.instance_id, { step_id: pend.stepId ?? '', approved })
        : await resolveProcessDeviation(active.instance_id, approved)
    setActive(next)
  }

  const complete = async () => {
    if (!active) return
    setActive(await completeProcessInstance(active.instance_id, 'completed'))
  }

  if (!sessionId) return null

  const pend = active ? pendingApproval(active) : null

  return (
    <div className="procbar">
      {!active && !picking && (
        <button className="procbar__set" onClick={openPicker}>
          + Set process
        </button>
      )}

      {!active && picking && (
        <div className="procbar__picker">
          <select value={chosen} onChange={(e) => { setChosen(e.target.value); setSuggestReason('') }}>
            <option value="">choose a process…</option>
            {templates.map((t) => (
              <option key={t.template_id} value={t.template_id}>
                {t.name}
                {t.is_preset ? ' (preset)' : ''}
                {t.risk_level ? ` · ${t.risk_level}` : ''}
              </option>
            ))}
          </select>
          <button className="procbar__go" disabled={!chosen} onClick={start}>
            Start
          </button>
          <button className="procbar__link" onClick={() => setCreating((v) => !v)}>
            {creating ? 'cancel' : 'new…'}
          </button>
          <button className="procbar__link" onClick={() => { setPicking(false); setSuggestReason('') }}>
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
          <input placeholder="Process name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <textarea
            placeholder="Describe the process in plain text — state its gates (e.g. 'pause for approval before shipping') and loops."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={4}
          />
          {review && (
            <div className="procbar__review">
              {review.findings.length > 0 && (
                <ul className="procbar__findings">
                  {review.findings.map((f: ProcessReview["findings"][number], i: number) => (
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
                    {review.clarifying_questions.map((q: string, i: number) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              )}
              {review.suggested_body && (
                <button className="procbar__link" onClick={() => setNewBody(review.suggested_body || '')}>
                  use Tirzah's suggested rewrite
                </button>
              )}
            </div>
          )}
          <div className="procbar__createbtns">
            <button className="procbar__link" onClick={runReview}>Review with Tirzah</button>
            <button className="procbar__go" onClick={create}>Save process</button>
          </div>
        </div>
      )}

      {active && (
        <div className={`procbar__active procbar__active--${active.status}`}>
          <span className="procbar__badge">{active.template_name}</span>
          <span className="procbar__status muted">{active.status.replace('_', ' ')}</span>
          {active.status !== 'completed' && active.status !== 'abandoned' && (
            <button className="procbar__link" onClick={complete}>complete</button>
          )}
          {pend && (
            <div className="procbar__gate">
              <span className="procbar__gatetext">⏸ {pend.text}</span>
              <button className="procbar__approve" onClick={() => approve(true)}>Approve</button>
              <button className="procbar__reject" onClick={() => approve(false)}>Reject</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
