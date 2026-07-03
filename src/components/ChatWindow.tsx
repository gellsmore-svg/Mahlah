import { useEffect, useRef, useState } from 'react'
import Markdown from '../markdown'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
  onSuggestion?: (text: string) => void
}

const SUGGESTIONS = [
  'What documents do you hold in memory?',
  'What did we discuss in my most recent session?',
  'Summarise what you know about a topic I name.',
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        /* clipboard unavailable (http, permissions) — button is best-effort */
      })
  }

  return (
    <button className="bubble__copy" title="Copy answer" onClick={copy}>
      {copied ? '✓ copied' : '⧉ copy'}
    </button>
  )
}

export default function ChatWindow({ messages, onSuggestion }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="chat chat--empty">
        <div className="welcome">
          <h1>Mahlah</h1>
          <p className="muted">Ask Tirzah anything. The answer stays clean; the process appears on the right.</p>
          {onSuggestion && (
            <div className="welcome__suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} className="suggestion" onClick={() => onSuggestion(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`bubble bubble--${message.role} ${message.error ? 'bubble--error' : ''}`}
          >
            <div className="bubble__head">
              <span className="bubble__role">{message.role === 'user' ? 'You' : 'Tirzah'}</span>
              {message.role === 'assistant' && !message.pending && !message.error && message.text && (
                <CopyButton text={message.text} />
              )}
            </div>
            {message.pending ? (
              <div className="bubble__text">
                <span className="typing">Thinking…</span>
              </div>
            ) : message.role === 'assistant' && !message.error ? (
              // Keep .bubble__text: it is the e2e/user-facing "answer container" hook.
              <div className="bubble__text bubble__text--md">
                <Markdown text={message.text} />
              </div>
            ) : (
              <div className="bubble__text">{message.text}</div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
