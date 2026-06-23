# Reinforcement loop

How Claude Code learns from past sessions and feeds the learnings back into
`AGENTS.md` and skills — token-efficiently, as shared team memory checked into
the repo. Grounded in Anthropic's guidance on self-improving agents (Agent
Skills, "Writing tools for agents", context engineering).

## Three stages — cheap+often → expensive+rare

| Stage | Trigger | Model | Reads | Writes |
|-------|---------|-------|-------|--------|
| 0 capture | `SessionEnd` hook (auto) | none | session transcript | local signal row + filtered cache (`.local/`, gitignored) |
| 1 distill | `/distill` (manual) | Opus | local signals + filtered cache | shared `candidates/<day>.jsonl` |
| 2 reinforce | `/reinforce` (manual) | Opus | shared candidates | `AGENTS.md` / `docs/` / skills via PR |

A `SessionStart` hook does a cheap, non-blocking daily check and reminds you to
run `/distill` / `/reinforce` when they're due today — it never auto-runs them.

**Invariant:** the raw transcript is read exactly once, locally, and **filtered
(~−90%) before any model sees it** — the model reads only the filtered transcript,
never the raw one. Stage 2 reads only compact candidates, never transcripts.

## Why this split saves tokens

- Most sessions cost **0 tokens** (Stage 0 is pure Node/bash).
- Stage 1 filters transcripts (~−90%) before the model, gates on a signal score, and batches.
- Stage 2 reads only structured rows, so its cost scales with *learnings*, not transcript size.

## The signature mechanism (how it "gets better")

Each learning is keyed by a canonical `sig`. `/distill` is fed the existing sig
vocabulary so it **reuses** keys → cross-session/cross-user matching is a key
match, not fuzzy NLP. `/reinforce` then promotes any `sig` seen **≥2 times**
into `AGENTS.md`; **different authors rank higher**; seen once stays `watching`.

## Files

- Hooks: `.claude/reinforce-capture.{sh,mjs}` (Stage 0, `SessionEnd`); `.claude/reinforce-daily.{sh,mjs}` (daily reminder, `SessionStart`).
- Skills: `.agents/skills/distill/`, `.agents/skills/reinforce/` (slash-only).
- Data: `.agents/reinforcement-loop/` — `candidates/` (shared), `DECISIONS.md`
  (the memory: promoted/rejected/watching), `REINFORCE-LOG.md`, `state.json`;
  `.local/` is per-machine and gitignored. See its [README](../../.agents/reinforcement-loop/README.md).

## Privacy

Signals and filtered caches stay local. Only sanitized candidates are committed;
both Stage 0 and Stage 1 strip secrets, tokens, emails, and absolute/home paths.
Consistent with the cookieless, no-PII posture (ADR 0001).
