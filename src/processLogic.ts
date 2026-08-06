import type { ProcessInstance } from './types'

export type PendingApproval = {
  kind: 'gate' | 'deviation'
  stepId?: string
  text: string
}

/**
 * Derive the operator-facing pause from an instance's status + trace.
 * Returns null when nothing is waiting on a human.
 */
export function pendingApproval(instance: ProcessInstance): PendingApproval | null {
  if (instance.status !== 'awaiting_gate') return null
  const last = [...instance.trace].reverse().find(
    (e) => e.event === 'process.gate.reached' || e.event === 'process.deviation.flagged',
  )
  if (!last) return { kind: 'gate', text: 'Paused for approval.' }
  if (last.event === 'process.deviation.flagged') {
    return {
      kind: 'deviation',
      text: `Deviation flagged: ${String(last.detail.description ?? '')}`,
    }
  }
  return {
    kind: 'gate',
    stepId: String(last.detail.step_id ?? ''),
    text: `Gate at step ${String(last.detail.step_id ?? '?')}.`,
  }
}
