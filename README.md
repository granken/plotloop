<p align="center">
  <img src="./assets/logo.svg" alt="plotloop" width="575">
</p>

<p align="center">
  <strong>Designing loops to change how you evolve.</strong><br>
  <em>Plot your loop.</em>
</p>

A workshop of **agents, skills, scripts and methodologies** for rewriting how we work — built around three convictions:

1. **Mobile-first AI** — the next interface for AI is the phone in your pocket, not a workstation
2. **OPC (One-Person Company)** — one person + a fleet of agents is the new unit of production
3. **AI-native organizations** — change the loop, change the org

---

## Why "plotloop"?

Two years ago, at a Coze hackathon, I built a small project called **storyplot** — about plotting a story into something visible. Two years later, the story keeps plotting itself, but a new realization joined in:

> **You don't have to evolve harder. You can change the environment that drives your evolution.**

That environment is a **loop**. And in the age of generative AI, the cost of *designing* a loop, *visualizing* it, and *running* it on autopilot has collapsed to near zero.

`plotloop` is the workshop where those loops get designed, plotted, and shipped.

---

## What's inside

| Path | What it holds |
|---|---|
| [`agents/`](./agents) | Complete agent workflows — packaged, runnable, observable |
| [`skills/`](./skills) | Plug-and-play Claude Code skills and reusable capabilities |
| [`scripts/`](./scripts) | Single-file scripts that solve one specific problem well |
| [`workflows/`](./workflows) | Case studies: how a linear workflow got rewritten as a loop |
| [`docs/`](./docs) | Methodology notes, inspirations, the longer-form thinking |

Every subdirectory has its own README. Start anywhere.

---

## Independent projects

Some PlotLoop artifacts grow into standalone products with their own repositories and release cycles:

### [PlotLoop Speaker Review](https://github.com/granken/plotloop-speaker-review)

A local-first meeting transcript workbench for reviewing uncertain speaker labels, correcting names from a touch-friendly roster, and exporting reusable `speaker-review v2` data.

[Try the fictional-data demo](https://granken.github.io/plotloop-speaker-review/) · [View releases](https://github.com/granken/plotloop-speaker-review/releases)

---

## Quickstart

The first artifact in this repo is **`scripts/mimo-balance/`** — a POSIX-shell + curl + python3 balance & billing checker for Xiaomi's MiMo open platform. Tiny on purpose: it embodies all the principles below.

```bash
cd scripts/mimo-balance
cp .env.example .env       # paste your MIMO_COOKIE
./mimo-checker.sh          # full report
```

Want it on your phone? See the README inside — there's a one-tap iOS Shortcut recipe.

---

## Principles

See [`PRINCIPLES.md`](./PRINCIPLES.md). The short version:

1. **Loop over Linear** — if it can be a loop, don't make it a line
2. **Mobile-first** — every artifact should reach you on a phone
3. **Cheap & Composable** — small, cheap, recombinable beats big and monolithic
4. **OPC-Ready** — if one person can't run it, the complexity is wrong
5. **Show, Don't Tell** — every artifact must have a real run, not a concept
6. **Trace > Magic** — observability beats "intelligence"

---

## Inspirations

- **Boris Cherny** on agentic loops (the talk that put a name on what I was already doing)

See [`docs/inspirations/`](./docs/inspirations) for the running list.

---

## License

MIT. Take what's useful, change what isn't.

---

> Maintained by [@rk](https://github.com/).
> 中文版：[README.zh.md](./README.zh.md)
