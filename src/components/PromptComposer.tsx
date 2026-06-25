import { useState, type KeyboardEvent } from 'react'
import type { ModelOption } from '../types'

interface Props {
  disabled: boolean
  models: ModelOption[]
  adapters: string[]
  modes: string[]
  model: string
  adapter: string
  mode: string
  onModelChange: (model: string) => void
  onAdapterChange: (adapter: string) => void
  onModeChange: (mode: string) => void
  onSend: (text: string) => void
}

export default function PromptComposer({
  disabled,
  models,
  adapters,
  modes,
  model,
  adapter,
  mode,
  onModelChange,
  onAdapterChange,
  onModeChange,
  onSend,
}: Props) {
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
        <select className="model-select" value={model} onChange={(event) => onModelChange(event.target.value)} title="Answer model">
          {models.length === 0 && <option value="">(no models)</option>}
          {models.map((option) => (
            <option key={option.name} value={option.name}>
              {option.label || option.name}
            </option>
          ))}
        </select>
        <select className="model-select" value={adapter} onChange={(event) => onAdapterChange(event.target.value)} title="Answer adapter">
          {adapters.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select className="model-select" value={mode} onChange={(event) => onModeChange(event.target.value)} title="Retrieval mode">
          {modes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
