import type { Conversation } from '../types'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  collapsed: boolean
  onSelect: (id: string) => void
  onNewChat: () => void
  onToggle: () => void
}

export default function ConversationSidebar({
  conversations,
  activeId,
  collapsed,
  onSelect,
  onNewChat,
  onToggle,
}: Props) {
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
            <button
              key={conversation.id}
              className={`conv ${conversation.id === activeId ? 'conv--active' : ''}`}
              onClick={() => onSelect(conversation.id)}
              title={conversation.title}
            >
              {conversation.title}
            </button>
          ))}
        </nav>
      )}
    </aside>
  )
}
