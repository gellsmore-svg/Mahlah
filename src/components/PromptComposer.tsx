import { useState, type KeyboardEvent } from 'react'

interface Props {
  disabled: boolean
  model: string
  onModelChange: (model: string) => void
  onSend: (text: string) => void
}

const MODELS = ['gemma3:1b', 'gemma2:latest', 'gemma4:latest', 'llama3.2:latest']

export default function PromptComposer({ disabled, model, onModelChange, onSend }: Props) {
  const [text, setText] = useState('')

  const send = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="composer">
      <div className="composer__box">
        <textarea
          className="composer__input"
          placeholder="Message Tirzah…   (Enter to send · Shift+Enter for newline)"
          value={text}
          rows={1}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="composer__send" title="Send" onClick={send} disabled={disabled || !text.trim()}>
          ➤
        </button>
      </div>
      <div className="composer__meta">
        <select
          className="model-select"
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          title="Answer model"
        >
          {MODELS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="muted composer__hint">Tirzah · local memory</span>
      </div>
    </div>
  )
}
