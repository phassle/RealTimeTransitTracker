---
name: distill
description: Distill local Claude Code session signals into shared learning candidates for the reinforcement loop (Stage 1). Reads .agents/reinforcement-loop/.local signals captured by the SessionEnd hook and runs headless Haiku over the filtered transcripts to emit structured candidates. Use ONLY when the user explicitly runs /distill — never auto-invoke.
disable-model-invocation: true
argument-hint: "Optional: --dry to preview which sessions would be distilled"
---

# /distill — capture learnings from recent sessions (Stage 1)

Turns the **local** signals written by the `SessionEnd` hook into **shared,
committed** learning candidates. Part of the [reinforcement loop](../../reinforcement-loop/README.md).

**Cost discipline:** the analysis runs on **Opus via a headless `claude -p`
call inside the script** — do NOT read transcripts into your own context. The
model only ever sees the **filtered** transcript (~−90% smaller), never the raw
one. Your job is to run the script, sanity-check its output, and stage it for commit.

## Run

```bash
node "$CLAUDE_PROJECT_DIR/.agents/skills/distill/scripts/distill.mjs" "$CLAUDE_PROJECT_DIR" $ARGUMENTS
```

- `$ARGUMENTS` may contain `--dry` → list the sessions that would be distilled, write nothing.
- Selects unprocessed sessions with `score ≥ REINFORCE_MIN_SCORE` (default 1; loose by design — fires often).
- Appends candidates to `.agents/reinforcement-loop/candidates/<day>.jsonl` and records processed sessions in `.local/distilled.json`.

## What the script does (so you can trust it)

1. Loads `.local/signals/*.jsonl`, drops already-processed sessions.
2. Builds the existing `sig` vocabulary from `DECISIONS.md` + recent candidates,
   so Haiku **reuses** keys → the same learning gets the same `sig` across sessions/users.
3. For each session, pipes the **filtered** transcript + the prompt in
   [reference/distill-prompt.md](reference/distill-prompt.md) to
   `claude -p --bare --model opus` (override with `REINFORCE_DISTILL_MODEL`; child sets `CLAUDE_REINFORCE_CHILD=1`; `--bare` skips hooks → no recursion).
4. Validates each emitted row, applies a secret/path **sanitization backstop**, enriches with author/session/day.

## After running

1. Review the new lines in `git diff .agents/reinforcement-loop/candidates/`.
   Confirm: sensible `sig`s, no secrets/emails/absolute paths, summaries make sense.
2. If a row looks wrong, edit or delete it (the file is plain JSONL).
3. Stage the candidates + `.local/distilled.json` is gitignored — only `candidates/` gets committed:
   ```bash
   git add .agents/reinforcement-loop/candidates/
   ```
   Commit rides along with your next PR (or open a small one). **Never push to `main`/`develop`.**

## Notes

- Candidates are the **shared** unit; raw signals + filtered caches stay local (gitignored).
- Promotion into `AGENTS.md` happens later in [/reinforce](../reinforce/SKILL.md), not here.
- If `claude` CLI is missing, the script aborts without writing.
