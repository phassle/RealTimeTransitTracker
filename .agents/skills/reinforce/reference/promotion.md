# Promotion rule & ledger format

## Rule (implemented in scripts/tally.mjs)

Candidates are grouped by `sig` across the **full** committed history.

- `count ≥ 2` → **promote** (encode into `AGENTS.md` / `docs/` / a skill).
- `distinct_authors ≥ 2` → **higher priority** (`cross_user: true`) — process first.
- `count == 1` → **watching** (record, do not touch `AGENTS.md`).
- sig already `promoted`/`rejected` in `DECISIONS.md` → **skipped** (no re-litigation).

Re-running is idempotent: the ledger, not a high-water-mark, guarantees a sig is
encoded at most once. `state.json.reinforced_through` is an informational marker only.

## The ledger — `decisions.jsonl` is the source of truth

`tally.mjs` reads `decisions.jsonl` (machine-readable) to decide what's already
ruled. After acting, **append one JSON row per sig** you touched:

```json
{"sig":"<sig>","status":"promoted|rejected|watching","count":<n>,"distinct_authors":<n>,"ruling":"<why + where it landed>","run":"<YYYY-MM-DD>"}
```

- **promoted**: rule/skill you added + where it landed (root / `docs/x.md` / skill name).
- **rejected**: why it's not worth encoding, or which side of a contradiction lost.
- **watching**: record the tally's watching sigs so the next run sees their prior count.

Then mirror the same rows into the `DECISIONS.md` table (the human view) so the
two stay in sync.

## skill-candidate sigs

If a promoted sig has `type` including `skill-candidate`, draft a new skill via
the `write-a-skill` skill (frontmatter, ≤150-line SKILL.md, progressive disclosure).
Record it as `promoted` with the skill name in the ruling.

## After encoding

1. Update `DECISIONS.md` (rows above) and `REINFORCE-LOG.md` (one summary line).
2. Set `state.json.reinforced_through` to today (`date +%F`).
3. Open a PR into `develop` via the `create-pr` skill. Never push to `main`/`develop`.
