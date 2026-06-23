# Reinforcement decisions ledger (human view)

The durable memory of the reinforcement loop. The **machine-readable source of
truth is [`decisions.jsonl`](decisions.jsonl)** — `/distill` and `/reinforce`
read that (one JSON object per line), not this table. `/reinforce` keeps this
table in sync as the human-readable view. Edit `decisions.jsonl` if you need to
change a ruling; re-render this table to match.

`/reinforce` reads the ledger **first** so it never re-litigates or re-discovers
a ruling. One entry per signature.

- **promoted** — written into `AGENTS.md` (or `docs/`/a skill). Won't be re-added.
- **rejected** — judged not worth encoding. Filtered out of future runs (so it can't resurface).
- **watching** — seen once (`count < 2`). Not yet promoted; tracked until it recurs.

`decisions.jsonl` row shape:

```json
{"sig":"skip-tests-before-pr","status":"promoted","count":2,"distinct_authors":2,"ruling":"Added to AGENTS.md Pre-PR gates","run":"2026-06-23"}
```

| sig | status | count | distinct authors | ruling / rationale | run |
|-----|--------|-------|------------------|--------------------|-----|
| _none yet_ | | | | | |
