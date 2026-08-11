import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  completeProcessInstance,
  createProcessTemplate,
  fetchProcessTemplates,
  resolveProcessDeviation,
  resolveProcessGate,
  startProcessInstance,
} from './api'

const responds = (status: number, body: string, contentType = 'application/json') =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(body, { status, headers: { 'Content-Type': contentType } }),
    ),
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * A backend that dies mid-session is the likeliest real failure, and it used to
 * report "Unexpected token < in JSON at position 0" — which reads like a client
 * bug, not an outage.
 */
describe('write calls report the status when the error body is not JSON', () => {
  const cases: [string, () => Promise<unknown>][] = [
    ['createProcessTemplate', () => createProcessTemplate({ name: 'n', body: 'b' })],
    ['startProcessInstance', () => startProcessInstance({ template_id: 't', task: 'x', sessionId: 's' })],
    ['resolveProcessGate', () => resolveProcessGate('i', { step_id: '1', approved: true })],
    ['resolveProcessDeviation', () => resolveProcessDeviation('i', true)],
    ['completeProcessInstance', () => completeProcessInstance('i', 'done')],
  ]

  it.each(cases)('%s surfaces a 502 with an HTML body', async (_name, call) => {
    responds(502, '<html>502 Bad Gateway</html>', 'text/html')
    await expect(call()).rejects.toThrow(/502/)
  })

  it.each(cases)('%s surfaces a 500 with an empty body', async (_name, call) => {
    responds(500, '')
    await expect(call()).rejects.toThrow(/500/)
  })

  it('still prefers the backend detail when there is one', async () => {
    responds(400, JSON.stringify({ detail: 'template name taken' }))
    await expect(createProcessTemplate({ name: 'n', body: 'b' })).rejects.toThrow(
      'template name taken',
    )
  })

  it('falls back to the status when detail is present but empty', async () => {
    responds(409, JSON.stringify({ detail: '   ' }))
    await expect(createProcessTemplate({ name: 'n', body: 'b' })).rejects.toThrow(/409/)
  })

  it('falls back to the status when detail is not a string', async () => {
    responds(422, JSON.stringify({ detail: [{ msg: 'bad' }] }))
    await expect(createProcessTemplate({ name: 'n', body: 'b' })).rejects.toThrow(/422/)
  })
})

describe('read calls degrade rather than throw', () => {
  it('a success body missing its wrapper key yields an empty list', async () => {
    responds(200, JSON.stringify({}))
    await expect(fetchProcessTemplates()).resolves.toEqual([])
  })
})
