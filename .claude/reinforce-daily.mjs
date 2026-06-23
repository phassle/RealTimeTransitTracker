#!/usr/bin/env node
// Reinforcement loop — daily check (invoked by reinforce-daily.sh on SessionStart).
//
// CHEAP and NON-BLOCKING: no LLM, just reads small JSON/JSONL files. Decides
// whether /distill or /reinforce is "due" today and, if so, prints a short
// context line so the agent proactively offers to run them — WITHOUT auto-running
// (the user chose the human-in-the-loop variant). Never throws; exits 0.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadJsonlDir, ruledSigs } from "../.agents/reinforcement-loop/lib.mjs";

const root = process.argv[2] || process.cwd();
const MIN = Number(process.env.REINFORCE_MIN_SCORE || 1);
const RL = join(root, ".agents", "reinforcement-loop");
const LOCAL = join(RL, ".local");
const today = new Date().toISOString().slice(0, 10);
const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };

function main() {
  // distill due: unprocessed local sessions above the threshold.
  const processed = new Set(readJson(join(LOCAL, "distilled.json"), {}).sessions || []);
  const distillDue = loadJsonlDir(join(LOCAL, "signals")).filter((s) => !processed.has(s.session) && s.score >= MIN).length;

  // reinforce due: unruled candidate signatures exist AND it hasn't run today.
  const sigs = new Set(loadJsonlDir(join(RL, "candidates")).map((c) => c.sig).filter(Boolean));
  const ruled = ruledSigs(RL);
  const unruled = [...sigs].filter((s) => !ruled.has(s)).length;
  const ranToday = readJson(join(RL, "state.json"), {}).reinforced_through === today;
  const reinforceDue = unruled > 0 && !ranToday;

  if (!distillDue && !reinforceDue) return; // nothing due → stay quiet.

  const lines = ["⟳ Reinforcement loop — daily check:"];
  if (distillDue) lines.push(`- /distill: ${distillDue} local session(s) ready to distill into candidates.`);
  if (reinforceDue) lines.push(`- /reinforce: due — ${unruled} unruled candidate signature(s), not yet run today.`);
  lines.push("Proactively offer to run the due step(s) for the user (slash-only — do not auto-run).");
  console.log(lines.join("\n"));
}

try { main(); } catch { /* best-effort: never disrupt session start */ }
