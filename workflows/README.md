# workflows/

> Case studies: how a linear workflow got **pivoted** into a loop.

This directory is the "before/after gallery". Each entry takes one real-world workflow that used to be linear and painful, and documents exactly **how it was rewritten as a loop** — what pivoted, what got automated, what got cheaper.

Workflows are the **bridge** between principles and code. The principles say *why* loops win. The agents/skills/scripts give you *what* runs. This directory is *how* you got from one to the other.

## Anatomy of a workflow case study

Each case lives in its own directory and contains:

```
workflows/
└── <case-name>/
    ├── README.md       # narrative: before → pivot → after
    ├── before.md       # the linear workflow as it was (concrete steps)
    ├── after.md        # the loop version (with diagram)
    ├── pivot.md        # the moment the rewrite became obvious
    └── artifacts/      # the agents/skills/scripts that power the new loop
```

## The PIVOT moment

Every case study must articulate **the pivot** — the specific shift in framing that made the loop possible. Some patterns we've seen:

- *"I kept doing X manually until I realized X had three observable inputs"*
- *"The blocker wasn't the work, it was the trigger — once an event source existed, the loop wrote itself"*
- *"Two unrelated linear scripts merged into one loop the moment they shared a state"*

If you can't articulate the pivot, the case study isn't done.

## Coming soon

- *[placeholder]* `daily-review/` — from manual daily review to a self-running loop
- *[placeholder]* `inbox-triage/` — from "process inbox" to "inbox processes itself"
- *[placeholder]* `competitor-watch/` — from quarterly competitor reports to a continuous loop
