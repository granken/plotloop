# agents/

> Complete agent workflows — packaged, runnable, observable.

This directory holds **full agent loops**: a goal, an observe-decide-act cycle, and the plumbing to run it on autopilot.

If your artifact is a one-shot helper, it belongs in [`../scripts/`](../scripts) instead. If it's a reusable capability that plugs into something else, it belongs in [`../skills/`](../skills).

## What an agent in this repo looks like

Every agent here ships with:

| File | Purpose |
|---|---|
| `README.md` | What the agent does, the loop diagram, real-run output |
| `<agent_name>.py` (or `.ts`) | The loop implementation |
| `.env.example` | Required credentials and config |
| `prompts/` | Prompt templates, versioned in plain text |
| `runs/` | A few real runs (logs + costs) as evidence |

## Loop diagram convention

Every agent README starts with a loop diagram in this shape:

```
┌─────────────┐
│   OBSERVE   │  ← what the agent sees
└──────┬──────┘
       ▼
┌─────────────┐
│   DECIDE    │  ← LLM call(s)
└──────┬──────┘
       ▼
┌─────────────┐
│    ACT      │  ← tool calls / side effects
└──────┬──────┘
       │
       └──────── back to OBSERVE
```

If you can't draw your agent like this, it's not a loop — it's a script. Put it in `scripts/`.

## Coming soon

- *[placeholder]* OPC daily review agent
- *[placeholder]* Inbox triage agent
- *[placeholder]* Watchlist watchdog
