#!/usr/bin/env node
// /reinforce — Stage 2 tally. Group shared candidates by `sig`, apply the
// promotion rule, and emit the work list. Deterministic; prints JSON to stdout.
//
// Promotion rule: count ≥2 → promote; distinct authors ≥2 → higher priority;
// count 1 → watching. Sigs already ruled in decisions.jsonl are skipped.
//
// Reads the FULL candidate history (rows are tiny) so counts are accurate even
// when an earlier "watching" sig recurs in a later batch. The ledger
// (decisions.jsonl) prevents re-promotion, so re-runs are idempotent.
//
// Usage: node tally.mjs <repo-root>
import { join } from "node:path";
import { loadJsonlDir, ruledSigs } from "../../../reinforcement-loop/lib.mjs";

const root = process.argv[2] || process.cwd();
const RL = join(root, ".agents", "reinforcement-loop");

const groups = new Map();
for (const c of loadJsonlDir(join(RL, "candidates"))) {
  if (!c.sig) continue;
  const g = groups.get(c.sig) || { sig: c.sig, count: 0, authors: new Set(), types: new Set(), summaries: [] };
  g.count++; g.authors.add(c.author || "unknown"); g.types.add(c.type);
  if (g.summaries.length < 3 && c.summary) g.summaries.push(c.summary);
  groups.set(c.sig, g);
}

const done = ruledSigs(RL);
const promoted = [], watching = [], skipped = [];
for (const g of groups.values()) {
  const rec = { sig: g.sig, count: g.count, distinct_authors: g.authors.size, types: [...g.types], summaries: g.summaries, cross_user: g.authors.size >= 2 };
  if (done.has(g.sig)) skipped.push(rec);
  else if (g.count >= 2) promoted.push(rec);
  else watching.push(rec);
}
// cross-user first, then by count.
promoted.sort((a, b) => Number(b.cross_user) - Number(a.cross_user) || b.count - a.count);

console.log(JSON.stringify({
  promoted, watching, skipped,
  totals: { sigs: groups.size, promoted: promoted.length, watching: watching.length, skipped: skipped.length },
}, null, 2));
