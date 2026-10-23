# Mahlah

**Mahlah is a chat interface for your Tirzah memory, built to keep the answer
separate from the machinery behind it.** You see a clean conversational
reply. Beside it, what the system did to produce that answer is shown live:
retrieval, context selection, research, generation, and the running plan.

Mahlah is the front end that was split out of
[Tirzah](https://github.com/gellsmore-svg/tirzah). Tirzah does the memory,
retrieval and model work; Mahlah only presents it.

## Three channels, never mixed

1. **Answer:** the reply in the chat, rendered as markdown with a copy
   button. It never contains process scaffolding, chain-of-thought or
   database mechanics.
2. **Process:** a live panel showing what the system is doing for this
   request. When Tirzah runs a Deborah plan, the panel streams the plan as it
   executes, with construct badges (CALL, ITERATE, DECISION…) and step ids.
3. **Dev log:** the full, serial trace of the request lifecycle in a separate
   window (`⤢`), with history and live events and copy-as-JSON. It is
   suitable for a developer, or another AI assistant, to watch.

## Is it for you?

**Good fit:** you run Tirzah and want a familiar chat UI that also shows *how*
each answer was produced, plus human oversight of agentic work through the
Process Bar.

**Not a fit:** a standalone chatbot. Mahlah has no backend of its own and needs
a running Tirzah.

## Try it

```bash
tirzah serve                       # Tirzah's API on :8765
npm install && npm run dev         # Mahlah on http://localhost:5273
```

Mahlah proxies `/api` to `http://localhost:8765`; override with
`VITE_TIRZAH_API`. The model, adapter and retrieval-mode menus fill from
Tirzah's `/api/runtime`, so they show what is actually installed. The UI
defaults to an e-ink-friendly high-contrast theme.

## What you can do

- **Converse.** Conversations are auto-titled from the first prompt, and can
  be renamed or deleted. Enter sends; Shift+Enter adds a new line.
- **Oversee agentic work with the Process Bar.** Bind a conversation to a
  human-defined process template (one is suggested from your first message),
  have Tirzah review a draft process, and approve or reject gate and
  deviation pauses as they come up. Failures show as a banner, never as
  silent no-ops.
- **Leave feedback** (`⚑`) tied to the current session and trace. It is
  stored as a record and as a `feedback.submitted` trace event.

## Know before you rely on it

- **Conversations are stored in this browser only** (localStorage, keyed by
  Tirzah's session id, capped in size). They do not sync between browsers or
  machines yet.
- Titles come from the first prompt, not from a model.
- Tirzah still ships its older built-in UI; retiring it is pending a live
  run-through.

## Develop

```bash
npm test                           # vitest: Process Bar approval-state logic
npm run e2e                        # end-to-end against a real Tirzah
```

End-to-end answers wait up to 120 s by default, because Tirzah does real
memory work for each exchange (`MAHLAH_E2E_ANSWER_TIMEOUT`, in ms).

The endpoints Mahlah calls, with the response shape it relies on, are in
[docs/tirzah-api-contract.md](docs/tirzah-api-contract.md). Event types are
defined by [Galeed](https://github.com/gellsmore-svg/galeed) and served by
Tirzah. The [2026-08-11 review](docs/review-2026-08-11.md) findings are all
actioned.

*Mahlah is one of the daughters of Zelophehad, like her sisters Tirzah, Noa,
Hoglah and Milcah.*
