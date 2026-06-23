---
name: reinforce
description: Consolidate the reinforcement loop's shared learning candidates into AGENTS.md, docs/, and new skills, then open a PR (Stage 2). Groups candidates by signature, promotes anything seen twice (cross-user ranks higher), and refactors AGENTS.md via a progressive-disclosure prompt. Use ONLY when the user explicitly runs /reinforce — never auto-invoke.
disable-model-invocation: true
argument-hint: "Optional: a focus area, e.g. 'only testing rules'"
---

# /reinforce — fold learnings into AGENTS.md + skills (Stage 2)

Consolidates the **shared** candidates produced by [/distill](../distill/SKILL.md)
into durable project guidance. Part of the [reinforcement loop](../../reinforcement-loop/README.md).
Runs rarely, on the strong model, but only ever reads **compact candidates —
never raw transcripts**.

## 1. Tally (deterministic)

```bash
node "$CLAUDE_PROJECT_DIR/.agents/skills/reinforce/scripts/tally.mjs" "$CLAUDE_PROJECT_DIR"
```

Prints `{ promoted, watching, skipped, totals }`. The **promotion rule** and the
ledger format live in [reference/promotion.md](reference/promotion.md):
seen ≥2 → promote, different authors → higher priority, seen once → watching,
already-ruled → skipped. If `promoted` is empty, report that and stop (nothing to do).

## 2. Encode the promoted learnings

Apply the **progressive-disclosure refactor** to `AGENTS.md`, feeding the promoted
learnings in as candidate rules/links. Follow [reference/progressive-disclosure.md](reference/progressive-disclosure.md)
**verbatim** (the 6-step prompt). Key points:

- Route each learning to the right altitude: root only if relevant to *every*
  task, else a `docs/<category>.md` or a skill, linked from the root map.
- Step 1 contradictions → **AskUserQuestion**; record the losing side as `rejected`.
- `type: skill-candidate` → draft a new skill via the `write-a-skill` skill.
- `CLAUDE.md` is a symlink to `AGENTS.md` — edit `AGENTS.md` only.
- If `$ARGUMENTS` names a focus area, limit this pass to matching sigs.

## 3. Record + ship

1. Append one JSON row per sig you acted on (promoted / rejected / watching) to
   `.agents/reinforcement-loop/decisions.jsonl` — the machine-readable ledger that
   stops the loop from re-discovering or re-litigating next run — then mirror the
   same rows into the `DECISIONS.md` table (human view). Format: [reference/promotion.md](reference/promotion.md).
2. Add a line to `REINFORCE-LOG.md`; set `state.json.reinforced_through` to `date +%F`.
3. Show the full diff to the user, then open a PR into `develop` via the
   [create-pr](../create-pr/SKILL.md) skill (it runs the pre-PR gates). **Never push to `main`/`develop`.**

## Guarantees

- **Idempotent**: `DECISIONS.md` ensures each sig is encoded at most once; re-runs are safe.
- **Bounded**: tally reads only structured candidate rows; the strong model never ingests transcripts.
- **Auditable**: every change lands in a PR with the ledger explaining why.
