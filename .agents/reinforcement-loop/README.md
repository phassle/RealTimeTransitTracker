# Reinforcement loop

Shared, checked-in memory that lets Claude Code learn from past sessions and
feed those learnings back into `AGENTS.md` / skills — token-efficiently.

## Pipeline (cheap+often → expensive+rare)

| Stage | When | Cost | What |
|-------|------|------|------|
| **0 capture** | every session (`SessionEnd` hook) | 0 tokens | `.claude/reinforce-capture.{sh,mjs}` parse the transcript → a signal row + a filtered transcript cache, both **local** (`.local/`, gitignored). |
| **1 distill** | manual `/distill` | Opus | reads local signals above threshold → headless Opus turns each into structured **learning candidates** (`candidates/<day>.jsonl`, shared/committed). |
| **2 reinforce** | manual `/reinforce` | Opus, rare | groups candidates by `sig`, applies the promotion rule, refactors `AGENTS.md` via progressive disclosure, drafts skills, opens a PR. |

**Invariant:** the raw transcript is read once, locally, and **filtered (~−90%)
before any model sees it** — the model only ever reads the filtered transcript,
never the raw one. Stage 2 reads only compact candidates, never transcripts.

A `SessionStart` hook (`.claude/reinforce-daily.sh`) does a cheap, non-blocking
daily check and reminds you to run `/distill` / `/reinforce` if they're due
today — it never auto-runs them (slash-only, human-in-the-loop).

## Promotion rule

A learning is keyed by a canonical `sig`. Same `sig` seen **≥2 times → promoted**
into `AGENTS.md`; **different authors → ranked higher**; seen once → `watching`.
Idempotent via `sig` + [DECISIONS.md](DECISIONS.md).

## Layout

```
candidates/YYYY-MM-DD.jsonl   shared, committed, append-only learning candidates
DECISIONS.md                  the reinforcement memory: promoted | rejected | watching
REINFORCE-LOG.md              one line per /reinforce run
state.json                    { reinforced_through: "YYYY-MM-DD" } high-water-mark
.local/                       gitignored, per-machine: signals/ + filtered cache + distilled_through
```

Skills: [/distill](../skills/distill/SKILL.md) · [/reinforce](../skills/reinforce/SKILL.md).
Both are slash-only (never auto-invoked).
