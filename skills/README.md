# skills/

> Plug-and-play Claude Code skills and reusable capabilities.

A **skill** is a self-contained capability that an agent can pick up and use — like a power-up in *Metroid*, or a shrine in *Zelda*: small, focused, completable in isolation, but composable into much larger journeys.

## What lives here

| Skill type | Format | Use case |
|---|---|---|
| **Claude Code skills** | `<skill-name>/SKILL.md` + supporting files | Drop-in skills for the Claude Code harness |
| **Generic LLM skills** | `<skill-name>/` with a `prompt.md` + `run.py` | Skills callable from any LLM client |
| **Skill bundles** | A directory of related skills sharing context | Higher-order capabilities |

## Conventions

1. **One skill, one shrine.** A skill solves one named thing well. If it grew two responsibilities, split it.
2. **Markdown-first.** Behavior lives in `SKILL.md` / `prompt.md`. Code is the runner, not the spec.
3. **Idempotent by default.** Running a skill twice should never break anything.
4. **Document the failure mode.** Each skill's README has a "When this skill is wrong for the job" section.

## Available

| Skill | What it does |
|---|---|
| [`plotloop-align-host`](./plotloop-align-host) | Turns a requirements-vs-dev disagreement list into a meeting-host video that pauses at each item, plus a web player and a post-meeting AI prompt (中文) |

## Coming soon

- *[placeholder]* `loop-diagram` — generate the OBSERVE/DECIDE/ACT diagram from any agent file
- *[placeholder]* `cost-summary` — token + dollar cost report for any session
- *[placeholder]* `pivot-finder` — read a workflow, suggest the pivot point that converts it to a loop
