#!/usr/bin/env node
// /distill — Stage 1. Turn local session signals into shared learning candidates.
//
// SUBAGENT MODEL: the model call is NOT made by this script. It only
//   (a) PLANS the work — selects unprocessed sessions worth distilling, builds
//       the sig vocabulary, and locates each FILTERED transcript cache; and
//   (b) FINALIZES results — validates/sanitizes/enriches the candidate rows a
//       subagent produced, writes them to candidates/<day>.jsonl, and records
//       the sessions as processed.
// Between the two, the orchestrating /distill skill runs an Opus SUBAGENT per
// session: the subagent reads the FILTERED transcript (never the raw one) and
// emits candidate rows. Running inside the authenticated Claude Code session
// avoids the headless `claude -p` "Not logged in" problem, and keeps full
// transcripts out of the orchestrator's context (it only ever sees the rows).
//
// Usage:
//   node distill.mjs <repo-root> --plan
//       → prints a JSON manifest to stdout (writes nothing — also the dry/inspect mode):
//         { "vocab": [...], "sessions": [ { session, day, ts, author, score, cache } ] }
//   node distill.mjs <repo-root> --finalize <results.json>
//       → results.json: { "results": [ { session, day, ts, author,
//                          rows: [ { sig, type, summary, evidence } ] } ] }
//         validates each row, writes candidates/<day>.jsonl, updates distilled.json
//
//   env REINFORCE_MIN_SCORE (default 1), REINFORCE_VOCAB_SIZE (default 50)
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadJsonlDir, sanitize, ledgerSigs, isValidSig } from "../../../reinforcement-loop/lib.mjs";

const root = process.argv[2] || process.cwd();
const MIN = Number(process.env.REINFORCE_MIN_SCORE || 1);
const VOCAB_SIZE = Number(process.env.REINFORCE_VOCAB_SIZE || 50);
const RL = join(root, ".agents", "reinforcement-loop");
const LOCAL = join(RL, ".local");
const TYPES = new Set(["missing-rule", "friction", "error-pattern", "skill-candidate", "went-well"]);

// sig vocabulary = sigs in the ledger + recent candidates, so the subagent reuses keys.
function sigVocab() {
  const sigs = new Set(ledgerSigs(RL));
  for (const c of loadJsonlDir(join(RL, "candidates"))) if (c.sig) sigs.add(c.sig);
  return [...sigs].filter(Boolean).slice(-VOCAB_SIZE);
}

function loadProcessed() {
  const p = join(LOCAL, "distilled.json");
  return new Set((existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {}).sessions || []);
}

// Trusted backstop: normalize + validate + sanitize one raw row from a subagent.
// Returns the cleaned row, or null if it fails validation.
function cleanRow(o) {
  if (!o || !o.sig || !TYPES.has(o.type) || !o.summary) return null;
  const row = {
    sig: String(o.sig).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48),
    type: o.type,
    summary: sanitize(o.summary).slice(0, 140),
    evidence: sanitize(o.evidence || "").slice(0, 160),
  };
  return isValidSig(row.sig) ? row : null;
}

// --- Mode: plan -----------------------------------------------------------
// Select work and emit a manifest. Writes nothing (fixes the old --dry bug
// where dry runs still marked sessions processed).
function plan() {
  const processed = loadProcessed();
  const sessions = loadJsonlDir(join(LOCAL, "signals"))
    .filter((s) => !processed.has(s.session) && s.score >= MIN)
    .map((s) => ({ session: s.session, day: s.day, ts: s.ts, author: s.author, score: s.score, cache: join(RL, s.cache) }))
    .filter((s) => {
      if (existsSync(s.cache)) return true;
      process.stderr.write(`distill: ${s.session} filtered cache missing — skipping\n`);
      return false;
    });
  process.stdout.write(JSON.stringify({ vocab: sigVocab(), sessions }, null, 2) + "\n");
}

// --- Mode: finalize -------------------------------------------------------
function finalize(resultsPath) {
  const { results = [] } = JSON.parse(readFileSync(resultsPath, "utf8"));
  const processed = loadProcessed();
  let total = 0;
  for (const r of results) {
    const rows = (r.rows || [])
      .map(cleanRow)
      .filter(Boolean)
      .map((row) => ({ ...row, author: r.author, session: r.session, day: r.day, ts: r.ts }));
    if (rows.length) {
      mkdirSync(join(RL, "candidates"), { recursive: true });
      appendFileSync(join(RL, "candidates", `${r.day}.jsonl`), rows.map((o) => JSON.stringify(o)).join("\n") + "\n");
    }
    total += rows.length;
    processed.add(r.session);
  }
  mkdirSync(LOCAL, { recursive: true });
  writeFileSync(join(LOCAL, "distilled.json"), JSON.stringify({ sessions: [...processed] }, null, 2) + "\n");
  console.log(`distill: ${total} candidate(s) written across ${results.length} session(s).`);
}

// --- Dispatch -------------------------------------------------------------
if (process.argv.includes("--finalize")) {
  const resultsPath = process.argv[process.argv.indexOf("--finalize") + 1];
  if (!resultsPath) { console.error("distill: --finalize requires a <results.json> path"); process.exit(1); }
  finalize(resultsPath);
} else {
  // default (incl. --plan / --dry) = plan; never writes.
  plan();
}
