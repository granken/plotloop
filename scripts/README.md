# scripts/

> Single-file scripts that solve one specific problem well.

A script in plotloop is the smallest unit of useful work: **one file (or one tight directory), one purpose, runs in seconds, leaves no mess**.

Scripts are the gateway artifact. They get used hundreds of times, they're easy to share, and they're often the *seed* of a future agent — once you find yourself running the script in a loop, it's time to promote it to [`../agents/`](../agents).

## Anatomy of a script entry

Each script lives in its own directory:

```
scripts/
└── <script-name>/
    ├── README.md          # what it does, why, how, real output
    ├── <script>.{sh,py,ts,...}  # the implementation — any language, just keep it tight
    ├── .env.example       # config if needed
    └── shortcut.png       # iOS Shortcut for mobile trigger (optional but encouraged)
```

## Each script README must answer

1. **What problem does this solve?** (one sentence)
2. **Which principle does it embody?** (link to `PRINCIPLES.md`)
3. **How to run it?** (one command)
4. **What does success look like?** (real screenshot or log)
5. **How to put it on your phone?** (iOS Shortcut / webhook / chat bot)

## Current entries

- [`mimo-balance/`](./mimo-balance) — Xiaomi MiMo open-platform balance & billing checker (POSIX shell + curl + python3). *The seed artifact for this repo.*

## Coming soon

- *[placeholder]* `claude-cost-today` — quick today-only token spend
- *[placeholder]* `inbox-zero-snapshot` — capture inbox state to markdown
