# Mahlah

**The conversational web interface for the Tirzah memory engine — and, in time, the wider family.**

Mahlah is the front end that was split out of [Tirzah](https://github.com/gellsmore-svg/tirzah).
It is a ChatGPT/Claude-style chat application that talks to Tirzah's HTTP API. Its
defining principle is a **clean separation of three channels**:

1. **Answer** — the normal conversational reply shown in the chat. No process
   scaffolding, no chain-of-thought, no database mechanics.
2. **Process** — a live, structured view of what the system is doing
   (retrieval, context selection, research, model generation, persistence).
3. **Dev/system log** — a deeper, serial, inspectable trace of the full request
   lifecycle, openable in a separate live window, suitable for a developer *or*
   another AI assistant to watch.

The naming follows the family convention (the daughters of Zelophehad):
**Tirzah, Noa, Hoglah, Milcah — and Mahlah.**

## Why a separate project

Tirzah is the backend: semantic memory, MongoDB retrieval, model calls, the
process/trace event stream, and logging. Mahlah is the presentation layer. The
split keeps Tirzah lean and API-first, and lets the UI evolve independently —
and later point at other family backends (Mahalath, Hoglah, Cairn, Milcah)
through the same shared trace contract.

## What it consumes (Tirzah API contract)

Tirzah's backend already returns the 3-channel contract (Phase 1, complete):

- `POST /api/ask` →
  ```json
  {
    "answer": "clean conversational answer",
    "processEvents": [
      { "type": "retrieval.mongo.completed", "status": "ok",
        "summary": "Construct Retrieval Context", "trace_id": "trace_…",
        "session_id": "…", "seq": 3, "timestamp": "…", "metadata": {} }
    ],
    "traceId": "trace_…", "sessionId": "…", "messageId": "msg_…", "requestId": "req_…"
  }
  ```
- `GET /api/trace/stream?session_id=…|trace_id=…` — **SSE** live process/log stream
  (the process panel and the separate dev-log window subscribe here).
- `GET /api/trace/events?trace_id=…|session_id=…` — replay/poll persisted events.
- `POST /api/feedback` — free-text feedback tied to the current `traceId`/`sessionId`
  (stored as a structured record **and** a `feedback.submitted` trace event).

Structured event types are stable and extensible: `session.created`,
`message.user.submitted`, `process.started`, `retrieval.mongo.*`,
`context.selected`, `research.*`, `model.prompt.built`, `model.response.*`,
`answer.finalized`, `log.persisted`, `feedback.submitted`, … (see Tirzah
`src/tirzah/trace/events.py`).

## Planned UI (Phase 2)

- Collapsible **conversations sidebar** (auto-derived titles; compact "new chat").
- Central **rolling chat history** (user/assistant turns; continues a conversation).
- Bottom **composer** (Enter submits, Shift+Enter newline; compact send icon).
- **Process panel** — live request state, separate from the answer.
- Separate **live dev-log window/tab** — same session/trace ids, near-real-time.
- **Feedback panel** — brain-dump tied to the current trace.
- Non-dominating model selector.

Candidate components: `ConversationSidebar`, `ChatWindow`, `MessageList`,
`MessageBubble`, `PromptComposer`, `ProcessPanel`, `ProcessEventList`,
`DevLogViewer`, `FeedbackPanel`, `ModelSelector`, `NewChatButton`.

## Running it

```bash
# 1) Tirzah backend (uvicorn on :8765 by default)
cd ../Tirzah && tirzah serve
# 2) Mahlah (http://localhost:5273, proxies /api -> :8765)
npm install && npm run dev
```
Override the backend with `VITE_TIRZAH_API`. The model / adapter / retrieval-mode
dropdowns populate from the backend's `/api/runtime`, so they always reflect what's
actually installed.

## Status

**Stack: Vite + React + TypeScript.** Core implemented and building clean:

- ✅ Conversational layout — collapsible sidebar, rolling chat, bottom composer
  (Enter sends / Shift+Enter newline), compact send + model selector.
- ✅ Conversations — auto-titled from the first prompt, inline rename, delete;
  persisted client-side (localStorage) keyed by Tirzah `session_id`.
- ✅ Clean answers in chat; **process in a separate panel, live via SSE**.
- ✅ Separate **dev-log window** (`⤢`) — history + live, full event detail, copy-as-JSON.
- ✅ **Feedback** (`⚑`) — free-text, tied to the current session/trace.

Not yet done: LLM-derived titles, server-side session sync (`/api/sessions`), and
retiring Tirzah's old built-in static UI (pending a live run-through).
