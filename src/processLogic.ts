import type { ProcessInstance } from './types'

export type PendingApproval = {
  kind: 'gate' | 'deviation'
  stepId?: string
  text: string
}

/**
 * Derive the operator-facing pause from an instance's status + trace.
 * Returns null when nothing is waiting on a human.
 *
 * Every field of the trace entry is treated as optional. This runs during
 * render of the Process Bar, so a malformed or older entry used to throw and
 * take down the approve/reject control — the one surface whose job is
 * unblocking paused work, failing exactly when there is something to unblock.
 * A pause we cannot describe precisely is still a pause worth showing.
 */
export function pendingApproval(instance: ProcessInstance): PendingApproval | null {
  if (instance.status !== 'awaiting_gate') return null
  const trace = Array.isArray(instance.trace) ? instance.trace : []
  const last = [...trace].reverse().find(
    (e) => e?.event === 'process.gate.reached' || e?.event === 'process.deviation.flagged',
  )
  if (!last) return { kind: 'gate', text: 'Paused for approval.' }

  const detail: Record<string, unknown> = last.detail ?? {}
  if (last.event === 'process.deviation.flagged') {
    const description = scalar(detail.description)
    return {
      kind: 'deviation',
      text: description ? `Deviation flagged: ${description}` : 'Deviation flagged.',
    }
  }
  const stepId = scalar(detail.step_id)
  return {
    kind: 'gate',
    stepId: stepId ?? '',
    text: stepId ? `Gate at step ${stepId}.` : 'Gate reached — step not identified.',
  }
}

/** A renderable string for a detail value, or null when there isn't one. */
function scalar(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null // objects would render as "[object Object]"
}
