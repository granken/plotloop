# Principles

> The rules every artifact in this repo must pass before it gets merged.
> Designed to keep the workshop honest as it grows.

---

## 1. Loop over Linear

If a task can be expressed as a **loop** (observe → decide → act → observe again), don't ship it as a one-shot script.

**Why**: linear scripts age into garbage; loops survive because they self-correct.

**Smell test**: does this artifact get *better* the more it runs? If yes, it's a loop. If no, fix it.

---

## 2. Mobile-first

Every artifact must have a path to **run from a phone** — even if the implementation is on a server.

Examples:
- iOS Shortcut → webhook → script
- Chat-app bot wrapper
- Voice trigger

**Why**: the moment AI tools require a laptop, they fall out of the high-frequency creative loop. The phone is where ideas actually happen.

---

## 3. Cheap & Composable

- Small files over big frameworks
- Boring tools over novel ones
- Composition over invention

If a script needs more than one screen of code to explain, it's two scripts pretending to be one.

---

## 4. OPC-Ready

Every artifact must be runnable by **one person** — setup, operation, debugging, decommissioning.

**Rule of thumb**: if it takes more than 10 minutes from `git clone` to "first run succeeded", it failed the OPC test.

---

## 5. Show, Don't Tell

No artifact gets merged without **one real run** documented in the README:
- Input
- Output (a real screenshot or log, redacted as needed)
- Cost (tokens, dollars, time)

We don't collect concepts. We collect things that have actually been used.

---

## 6. Trace > Magic

Observable plumbing beats "intelligent" black boxes:
- Log every LLM call (prompt + response + cost) by default
- Make the loop's state inspectable
- "Why did it do that?" must always be answerable in under 60 seconds

**Magic that can't be traced is bug-disguised-as-feature.**

---

## 7. Visualize Aggressively

Charts, diagrams, screenshots — generated cheaply and embedded everywhere. In the AI era, the marginal cost of visualization is near zero, and yet **visualization is still the most under-used lever for understanding our own work**.

If you can't draw what your loop does, you don't understand your loop.

---

## 8. Honor the Origin

This repo grew out of **storyplot** (2024 Coze hackathon) — a tiny project about plotting a story into something visible. Two years later, the act of plotting is still the point; what changed is that the thing being plotted is now a **loop**.

When in doubt about a design decision, ask: *does this still feel like plotting something into existence?*

---

## 9. Bias toward Boring

Boring code, boring stacks, boring naming.

Save your novelty budget for the **loop design**, not the implementation.

---

## 10. The Pivot Rule

Borrowed from *Friends*: when something isn't fitting through the door, the answer isn't more force — it's **PIVOT**.

Every artifact in this repo started as a linear workflow that got pivoted into a loop. If you can't articulate the pivot moment, the artifact isn't ready.
