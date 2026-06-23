#!/usr/bin/env node
// /distill — Stage 1. Turn local session signals into shared learning candidates.
//
// Reads .local/signals/*.jsonl (Stage-0 output), selects unprocessed sessions
// worth distilling, and for each runs headless Haiku over the FILTERED transcript
// cache to emit structured candidates. The orchestrating agent must NOT read
// transcripts itself — this script keeps the cheap-model invariant.
//
// Usage: node distill.mjs <repo-root> [--dry]
//   env REINFORCE_MIN_SCORE (default 1), REINFORCE_DISTILL_MODEL (default "haiku"),
//       REINFORCE_VOCAB_SIZE (default 50)
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadJsonlDir, sanitize, ledgerSigs, isValidSig } from "../../../reinforcement-loop/lib.mjs";

const root = process.argv[2] || process.cwd();
const DRY = process.argv.includes("--dry");
const MIN = Number(process.env.REINFORCE_MIN_SCORE || 1);
const MODEL = process.env.REINFORCE_DISTILL_MODEL || "opus";
const VOCAB_SIZE = Number(process.env.REINFORCE_VOCAB_SIZE || 50);
const RL = join(root, ".agents", "reinforcement-loop");
const LOCAL = join(RL, ".local");
const PROMPT = readFileSync(join(root, ".agents", "skills", "distill", "reference", "distill-prompt.md"), "utf8");
const TYPES = new Set(["missing-rule", "friction", "error-pattern", "skill-candidate", "went-well"]);

// sig vocabulary = sigs in the ledger + recent candidates, so Haiku reuses keys.
function sigVocab() {
  const sigs = new Set(ledgerSigs(RL));
  for (const c of loadJsonlDir(join(RL, "candidates"))) if (c.sig) sigs.add(c.sig);
  return [...sigs].filter(Boolean).slice(-VOCAB_SIZE);
}

function distillSession(vocab, filteredPath) {
  const input = `${PROMPT}\n\nEXISTING SIGNATURE VOCABULARY (reuse when applicable):\n${vocab.join(", ") || "(none yet)"}\n\nFILTERED TRANSCRIPT:\n${readFileSync(filteredPath, "utf8")}`;
  const out = execFileSync("claude", ["-p", "--bare", "--model", MODEL], {
    input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, CLAUDE_REINFORCE_CHILD: "1" },
  });
  return out.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{"))
    .flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } })
    .filter((o) => o.sig && TYPES.has(o.type) && o.summary)
    .map((o) => ({ sig: String(o.sig).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48), type: o.type, summary: sanitize(o.summary).slice(0, 140), evidence: sanitize(o.evidence || "").slice(0, 160) }))
    .filter((o) => isValidSig(o.sig));
}

function main() {
  const processedPath = join(LOCAL, "distilled.json");
  const processed = new Set((existsSync(processedPath) ? JSON.parse(readFileSync(processedPath, "utf8")) : {}).sessions || []);
  const todo = loadJsonlDir(join(LOCAL, "signals")).filter((s) => !processed.has(s.session) && s.score >= MIN);
  if (!todo.length) { console.log("distill: nothing to do (no unprocessed sessions above threshold)"); return; }

  if (!DRY) {
    try { execFileSync("claude", ["--version"], { stdio: "ignore" }); }
    catch { console.error("distill: `claude` CLI not found — aborting."); process.exit(1); }
  }

  const vocab = sigVocab();
  let total = 0;
  for (const s of todo) {
    const cache = join(RL, s.cache);
    if (!existsSync(cache)) { console.log(`distill: ${s.session} cache missing, skip`); processed.add(s.session); continue; }
    console.log(`distill: ${s.session} (score ${s.score}, ${s.day})${DRY ? " [dry]" : ""}`);
    if (DRY) { processed.add(s.session); continue; }
    let rows = [];
    try { rows = distillSession(vocab, cache); }
    catch (e) { console.error(`distill: ${s.session} failed: ${e.message}`); continue; }
    const enriched = rows.map((r) => ({ ...r, author: s.author, session: s.session, day: s.day, ts: s.ts }));
    if (enriched.length) {
      mkdirSync(join(RL, "candidates"), { recursive: true });
      appendFileSync(join(RL, "candidates", `${s.day}.jsonl`), enriched.map((o) => JSON.stringify(o)).join("\n") + "\n");
    }
    total += enriched.length;
    processed.add(s.session);
  }
  mkdirSync(LOCAL, { recursive: true });
  writeFileSync(processedPath, JSON.stringify({ sessions: [...processed] }, null, 2) + "\n");
  console.log(`distill: ${total} candidate(s) written across ${todo.length} session(s).`);
}

main();
