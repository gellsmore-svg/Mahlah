import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_CONVERSATIONS,
  MAX_MESSAGES_PER_CONVERSATION,
  loadConversations,
  persistConversations,
} from './storage'
import type { Conversation } from './types'

const convo = (id: string, messages = 1): Conversation =>
  ({
    id,
    title: `chat ${id}`,
    messages: Array.from({ length: messages }, (_, i) => ({
      id: `m${i}`, role: 'user', text: 'hi',
    })),
  }) as Conversation

const store = (impl: Partial<Storage>) =>
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, ...impl })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadConversations salvages what it can', () => {
  it('drops records that fail the schema and keeps the rest', () => {
    store({
      getItem: () =>
        JSON.stringify([convo('a'), { id: 1 }, null, 'nonsense', convo('b')]),
    })
    expect(loadConversations().map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('returns empty for corrupt json rather than throwing', () => {
    store({ getItem: () => '{not json' })
    expect(loadConversations()).toEqual([])
  })

  it('returns empty when the payload is not an array', () => {
    store({ getItem: () => JSON.stringify({ conversations: [] }) })
    expect(loadConversations()).toEqual([])
  })
})

// The write used to have no handling at all: a QuotaExceededError stopped
// persistence silently and the user found out by losing history on reload.
describe('persistConversations survives a full store', () => {
  it('reports success as null', () => {
    store({})
    expect(persistConversations([convo('a')])).toBeNull()
  })

  it('degrades to recent history and says so when quota is hit once', () => {
    let calls = 0
    store({
      setItem: () => {
        calls += 1
        if (calls === 1) throw new DOMException('quota', 'QuotaExceededError')
      },
    })
    const message = persistConversations(
      Array.from({ length: 40 }, (_, i) => convo(`c${i}`)),
    )
    expect(message).toMatch(/10 most recent/)
    expect(calls).toBe(2)
  })

  it('reports plainly when storage is unusable entirely', () => {
    store({
      setItem: () => {
        throw new DOMException('nope', 'SecurityError')
      },
    })
    expect(persistConversations([convo('a')])).toMatch(/Could not save/)
  })

  it('caps conversations and messages before writing', () => {
    let written = ''
    store({ setItem: (_k: string, v: string) => { written = v } })
    persistConversations(
      Array.from({ length: MAX_CONVERSATIONS + 25 }, (_, i) =>
        convo(`c${i}`, MAX_MESSAGES_PER_CONVERSATION + 50),
      ),
    )
    const saved: Conversation[] = JSON.parse(written)
    expect(saved.length).toBe(MAX_CONVERSATIONS)
    expect(saved[0].messages.length).toBe(MAX_MESSAGES_PER_CONVERSATION)
    // The newest are kept, not the oldest.
    expect(saved[saved.length - 1].id).toBe(`c${MAX_CONVERSATIONS + 24}`)
  })
})
