# Boris Cherny on Agentic Loops

> Encountered: 2026-05-15
> Why it earned a place: it put a name on what I had already been doing — and crystallized the realization that the loop, not the agent, is the unit of leverage.

## The talk in one sentence

Boris (creator of Claude Code, Anthropic) argues that the next generation of AI work isn't about building smarter agents — it's about designing the **loops** those agents run inside, and that **loop design is the new craft**.

## What hit me

- The agent is a stateless function; the **loop** is where state, memory and improvement live
- "Mobile-first AI" isn't a UX preference, it's a structural property — the phone is the lowest-latency surface to *close* a loop in the real world
- A loop with poor observability isn't a loop, it's a black box that occasionally produces output
- The *cheapness of designing loops* in 2026 is itself the news — three years ago this took a team, today it takes an afternoon

## Where this lands in plotloop

- The `agents/` README borrows Boris's framing directly: **OBSERVE → DECIDE → ACT → OBSERVE**
- The `workflows/` directory exists because of this talk: the case-study format is meant to document the *pivot* from linear to looped
- The "Trace > Magic" principle in `PRINCIPLES.md` is a direct response to his observability argument

## My own thinking this confirmed

I'd already been collecting two intuitions that this talk made explicit:

1. **"Change the environment that drives your evolution"** — my own slogan for years, now revealed to be a loop-design statement in disguise
2. **"Visualization is the most under-used lever"** — Boris said it about loop observability, I'd been saying it about presentation; same lever, two faces

## Open questions I still want to answer

- What's the simplest loop that justifies its own observability overhead?
- When should a loop be *closed* (run autonomously) vs *open* (require human approval per cycle)?
- How do you migrate a long-running loop across LLM model upgrades without losing accumulated state?

---

*This is the origin entry of `docs/inspirations/`. The format is intentional: encountered date, why-it-earned-a-place, hits, lands-in-repo, my-thinking, open-questions.*
