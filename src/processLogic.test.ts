import { describe, expect, it } from 'vitest'
import { pendingApproval } from './processLogic'
import type { ProcessInstance, ProcessTraceEntry } from './types'

const base = (over: Partial<ProcessInstance> = {}): ProcessInstance => ({
  instance_id: 'i1',
  template_id: 't1',
  template_version: 1,
  template_name: 'Demo',
  process_body: 'do work',
  task: 'task',
  session_id: 's1',
  status: 'active',
  selection_reason: 'manual',
  trace: [],
  started_at: '2026-07-06T12:00:00Z',
  completed_at: null,
  outcome: null,
  ...over,
})

const entry = (event: string, detail: Record<string, unknown> = {}): ProcessTraceEntry => ({
  event,
  detail,
  at: '2026-07-06T12:00:01Z',
})

describe('pendingApproval', () => {
  it('returns null when status is not awaiting_gate', () => {
    expect(pendingApproval(base({ status: 'active' }))).toBeNull()
    expect(pendingApproval(base({ status: 'completed' }))).toBeNull()
  })

  it('returns a generic gate when awaiting with no matching trace', () => {
    expect(pendingApproval(base({ status: 'awaiting_gate', trace: [] }))).toEqual({
      kind: 'gate',
      text: 'Paused for approval.',
    })
  })

  it('reads gate step_id from the latest process.gate.reached event', () => {
    const instance = base({
      status: 'awaiting_gate',
      trace: [
        entry('process.started'),
        entry('process.gate.reached', { step_id: 's2' }),
      ],
    })
    expect(pendingApproval(instance)).toEqual({
      kind: 'gate',
      stepId: 's2',
      text: 'Gate at step s2.',
    })
  })

  it('prefers the latest deviation over an earlier gate', () => {
    const instance = base({
      status: 'awaiting_gate',
      trace: [
        entry('process.gate.reached', { step_id: 's1' }),
        entry('process.deviation.flagged', { description: 'skipped review' }),
      ],
    })
    expect(pendingApproval(instance)).toEqual({
      kind: 'deviation',
      text: 'Deviation flagged: skipped review',
    })
  })
})

// This runs during render of the Process Bar. A throw here takes down the
// approve/reject control — the surface whose job is unblocking paused work.
describe('pendingApproval survives malformed trace entries', () => {
  const awaiting = (trace: unknown[]) =>
    base({ status: 'awaiting_gate', trace: trace as ProcessTraceEntry[] })

  it('a gate entry with no detail key does not throw', () => {
    const result = pendingApproval(awaiting([{ event: 'process.gate.reached' }]))
    expect(result).toEqual({
      kind: 'gate',
      stepId: '',
      text: 'Gate reached — step not identified.',
    })
  })

  it('a deviation entry with no detail key does not throw', () => {
    expect(pendingApproval(awaiting([{ event: 'process.deviation.flagged' }]))).toEqual({
      kind: 'deviation',
      text: 'Deviation flagged.',
    })
  })

  it('a null entry in the trace is skipped', () => {
    const result = pendingApproval(
      awaiting([null, { event: 'process.gate.reached', detail: { step_id: '3' } }]),
    )
    expect(result?.stepId).toBe('3')
  })

  it('a non-array trace does not throw', () => {
    expect(
      pendingApproval(base({ status: 'awaiting_gate', trace: undefined as never })),
    ).toEqual({ kind: 'gate', text: 'Paused for approval.' })
  })

  it('an object detail value does not render as [object Object]', () => {
    const result = pendingApproval(
      awaiting([{ event: 'process.gate.reached', detail: { step_id: { nested: 1 } } }]),
    )
    expect(result?.text).not.toContain('[object')
  })

  it('a numeric step id still renders', () => {
    const result = pendingApproval(
      awaiting([{ event: 'process.gate.reached', detail: { step_id: 4 } }]),
    )
    expect(result?.text).toBe('Gate at step 4.')
  })
})
