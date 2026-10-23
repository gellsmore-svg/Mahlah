# Tirzah API contract (as consumed by Mahlah)

The parts of Tirzah's HTTP API that Mahlah calls, and the shape it relies on.
Moved from the root README (2026-10). Tirzah serves more routes than these;
this page lists only what Mahlah depends on.

## Endpoints Mahlah calls

Tirzah's backend returns the 3-channel contract:

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
  Those are the fields Mahlah consumes. The live response carries ~30 in total
  (including `ok`, `retrieval_status`, `semantic_status`, `process_trace`,
  `request_plan`); the extras are ignored. Worth knowing if the UI ever needs
  to distinguish "retrieval found nothing" from a confident-sounding answer.
- `GET /api/trace/stream?session_id=…|trace_id=…` — **SSE** live process/log stream
  (the process panel subscribes for the current request; the dev-log window
  subscribes with `replay=true` for history plus live events).
- `POST /api/feedback` — free-text feedback tied to the current `traceId`/`sessionId`
  (stored as a structured record **and** a `feedback.submitted` trace event).
- `GET /api/runtime` — adapters, models, and retrieval modes for the composer
  dropdowns.

## Process Bar (`/api/process/*`)

The **Process Bar** above the composer is the human-oversight surface for
agentic work. It binds a conversation to a human-defined process template,
auto-suggests a fit from the first message, and surfaces gate / deviation
pauses for approve/reject.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/process/templates` | List presets + saved templates |
| `POST` | `/api/process/templates` | Create a template (`name`, `body`, …) |
| `POST` | `/api/process/suggest` | Suggest a template for a task string |
| `POST` | `/api/process/review` | Tirzah review of a draft process body |
| `GET` | `/api/process/active?session_id=…` | Active instance for the session (404 → none) |
| `POST` | `/api/process/instances` | Start an instance on a session |
| `POST` | `/api/process/instances/{id}/gate` | Approve/reject a gate step |
| `POST` | `/api/process/instances/{id}/deviation/resolve` | Resolve a deviation |
| `POST` | `/api/process/instances/{id}/complete` | Mark the instance complete |

API failures surface as an inline banner in the bar (not silent no-ops).

Structured event types are stable and extensible: `session.created`,
`message.user.submitted`, `process.started`, `retrieval.mongo.*`,
`context.selected`, `research.*`, `model.prompt.built`, `model.response.*`,
`answer.finalized`, `log.persisted`, `feedback.submitted`, … (defined by
Galeed, with Tirzah currently serving the HTTP/SSE trace API).
