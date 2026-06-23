---
name: distill
description: Distill local Claude Code session signals into shared learning candidates for the reinforcement loop (Stage 1). Reads .agents/reinforcement-loop/.local signals captured by the SessionEnd hook and runs an Opus subagent over each filtered transcript to emit structured candidates. Use ONLY when the user explicitly runs /distill — never auto-invoke.
disable-model-invocation: true
argument-hint: "Optional: --dry to preview which sessions would be distilled"
---

# /distill — capture learnings from recent sessions (Stage 1)

Turns the **local** signals written by the `SessionEnd` hook into **shared,
committed** learning candidates. Part of the [reinforcement loop](../../reinforcement-loop/README.md).

**How the model call happens:** an **Opus subagent** (one per session) reads the
**filtered** transcript and emits candidate rows. The subagent runs inside this
authenticated Claude Code session — no headless `claude -p`, so no "Not logged
in" failure. **Cost discipline:** YOU (the orchestrator) must **never read a
transcript into your own context** — only the subagent reads it (it sees the
filtered transcript, ~−90% smaller, never the raw one) and hands you back only
the small candidate rows.

## Run

### 1. Plan — select the work (writes nothing)

```bash
node "$CLAUDE_PROJECT_DIR/.agents/skills/distill/scripts/distill.mjs" "$CLAUDE_PROJECT_DIR" --plan
```

Prints `{ "vocab": [...], "sessions": [ { session, day, ts, author, score, cache } ] }`.
Selects unprocessed sessions with `score ≥ REINFORCE_MIN_SCORE` (default 1; loose by design).
If `--dry` was requested, **stop here** and report the sessions — do nothing else.
If `sessions` is empty, tell the user there's nothing to distill.

### 2. Distill — one subagent per session

For **each** session in the manifest, launch a subagent (Agent tool, a fresh
`general-purpose` agent on **opus** — NOT a fork; do not pass it your context):

> Read and follow the distill instructions in
> `.agents/skills/distill/reference/distill-prompt.md`.
> EXISTING SIGNATURE VOCABULARY (reuse a key when it fits): `<vocab joined by ", ">`.
> Read the FILTERED TRANSCRIPT at `<cache>` and analyze it.
> Output **only** the candidate rows as JSONL — one JSON object per line
> (`{sig,type,summary,evidence}`), no prose, no code fences. Output nothing if there's nothing worth capturing.

Run sessions in parallel when there are several. Collect each subagent's JSONL
lines (parse only valid `{…}` lines). **Do not open the `cache` file yourself.**

### 3. Finalize — validate + write

Write the collected rows to a scratch file as
`{ "results": [ { session, day, ts, author, rows: [ {sig,type,summary,evidence} ] } ] }`,
then:

```bash
node "$CLAUDE_PROJECT_DIR/.agents/skills/distill/scripts/distill.mjs" "$CLAUDE_PROJECT_DIR" --finalize <results.json>
```

The script applies the secret/path **sanitization backstop**, validates each row
(`sig`/`type`/`summary`), enriches with author/session/day/ts, appends to
`.agents/reinforcement-loop/candidates/<day>.jsonl`, and records the sessions in
`.local/distilled.json`.

## After running

1. Review the new lines in `git diff .agents/reinforcement-loop/candidates/`.
   Confirm: sensible `sig`s, no secrets/emails/absolute paths, summaries make sense.
2. If a row looks wrong, edit or delete it (the file is plain JSONL).
3. `.local/distilled.json` is gitignored — only `candidates/` gets committed:
   ```bash
   git add .agents/reinforcement-loop/candidates/
   ```
   Commit rides along with your next PR (or open a small one). **Never push to `main`/`develop`.**

## Notes

- Candidates are the **shared** unit; raw signals + filtered caches stay local (gitignored).
- Promotion into `AGENTS.md` happens later in [/reinforce](../reinforce/SKILL.md), not here.
- `--plan` writes nothing — safe to run any time to see what's pending (this is also `--dry`).
- The subagent reuses sig keys from the manifest's `vocab` so the same learning gets the same `sig` across sessions/users.
