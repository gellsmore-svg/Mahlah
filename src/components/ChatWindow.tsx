import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
}

export default function ChatWindow({ messages }: Props) {
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
            <div className="bubble__role">{message.role === 'user' ? 'You' : 'Tirzah'}</div>
            <div className="bubble__text">
              {message.pending ? <span className="typing">Thinking…</span> : message.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
