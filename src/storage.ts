import type { Conversation } from './types'

/**
 * Client-side conversation persistence.
 *
 * Extracted from App so the failure paths are testable: the read path was
 * carefully defensive about corrupt storage while the write had no handling at
 * all, which meant a `QuotaExceededError` stopped persistence silently and the
 * user only discovered it by losing history on reload.
 */

export const STORAGE_KEY = 'mahlah.conversations.v1'

// localStorage is typically 5-10 MB and chat history otherwise grows forever.
// Trimming the oldest is the honest trade: it is visible in the sidebar, where
// hitting quota is not.
export const MAX_CONVERSATIONS = 100
export const MAX_MESSAGES_PER_CONVERSATION = 200

/** Load, schema-checking each record and salvaging the valid ones. */
export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is Conversation =>
        !!c && typeof c === 'object'
        && typeof (c as Conversation).id === 'string'
        && typeof (c as Conversation).title === 'string'
        && Array.isArray((c as Conversation).messages),
    )
  } catch {
    return []
  }
}

/**
 * Write conversations; returns a message to show the user on failure, else null.
 * Trims to the caps above, then retries with only the newest few, so a long
 * session degrades to recent history rather than to nothing.
 */
export function persistConversations(conversations: Conversation[]): string | null {
  const trimmed = conversations.slice(-MAX_CONVERSATIONS).map((c) => ({
    ...c,
    messages: c.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
  }))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    return null
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.slice(-10)))
      return 'Storage full — only the 10 most recent conversations are being saved.'
    } catch {
      return 'Could not save conversations to this browser (storage unavailable or full).'
    }
  }
}
