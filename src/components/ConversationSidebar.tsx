import { useState, type KeyboardEvent } from 'react'
import type { Conversation } from '../types'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  collapsed: boolean
  onSelect: (id: string) => void
  onNewChat: () => void
  onToggle: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export default function ConversationSidebar({
  conversations,
  activeId,
  collapsed,
  onSelect,
  onNewChat,
  onToggle,
  onRename,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const startRename = (conversation: Conversation) => {
    setEditingId(conversation.id)
    setDraft(conversation.title)
  }
  const commitRename = () => {
    if (editingId) onRename(editingId, draft)
    setEditingId(null)
  }
  const onEditKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitRename()
    if (event.key === 'Escape') setEditingId(null)
  }
  const confirmDelete = (conversation: Conversation) => {
    if (window.confirm(`Delete "${conversation.title}"?`)) onDelete(conversation.id)
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__head">
        <button className="icon-btn" title={collapsed ? 'Expand' : 'Collapse'} onClick={onToggle}>
          ☰
        </button>
        {!collapsed && <span className="sidebar__brand">Mahlah</span>}
        {!collapsed && (
          <button className="icon-btn icon-btn--accent" title="New chat" onClick={onNewChat}>
            ✎
          </button>
        )}
      </div>

      {collapsed ? (
        <button className="icon-btn icon-btn--accent sidebar__newcollapsed" title="New chat" onClick={onNewChat}>
          ✎
        </button>
      ) : (
        <nav className="sidebar__list">
          {conversations.length === 0 && <p className="muted sidebar__empty">No conversations yet.</p>}
          {conversations.map((conversation) => (
            <div key={conversation.id} className={`conv ${conversation.id === activeId ? 'conv--active' : ''}`}>
              {editingId === conversation.id ? (
                <input
                  className="conv__edit"
                  value={draft}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onEditKey}
                  onBlur={commitRename}
                />
              ) : (
                <button
                  className="conv__btn"
                  onClick={() => onSelect(conversation.id)}
                  onDoubleClick={() => startRename(conversation)}
                  title={`${conversation.title}  (double-click to rename)`}
                >
                  {conversation.title}
                </button>
              )}
              <button className="conv__del" title="Delete conversation" onClick={() => confirmDelete(conversation)}>
                ✕
              </button>
            </div>
          ))}
        </nav>
      )}
    </aside>
  )
}
