#!/usr/bin/env node
// Reinforcement loop — Stage 0 parser (invoked by reinforce-capture.sh).
//
// Input : SessionEnd hook JSON on stdin ({ transcript_path, session_id, cwd, ... }).
// Output: appends one signal row to .local/signals/<day>.jsonl and writes a
//         filtered transcript to .local/cache/<session>.filtered.jsonl.
// Contract: deterministic, zero tokens, never throws to the caller (best-effort).
//
// The correction-marker regex / redo-count / score here are a cheap RECALL
// prefilter for "which sessions are worth distilling" — the actual judgment is
// deferred to Haiku in /distill. They don't need to be precise.
import { readFileSync, mkdirSync, appendFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { readJsonl, sanitize } from "../.agents/reinforcement-loop/lib.mjs";

const root = process.argv[2] || process.cwd();
const LOCAL = join(root, ".agents", "reinforcement-loop", ".local");
const cap = (s, n) => sanitize(s).slice(0, n);

const CORRECTION_RE =
  /\b(nej|inte s[åa]|i ?st[äa]llet|fel(?:aktig)?|backa|[åa]ngra|no,|not (?:that|what)|wrong|revert|undo|don'?t do)\b/i;

function readStdin() {
  try { return JSON.parse(readFileSync(0, "utf8")); } catch { return {}; }
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((b) => b?.type === "text").map((b) => b.text || "").join("\n");
}

function main() {
  const { transcript_path, session_id = "unknown", cwd } = readStdin();
  if (!transcript_path) return;
  const events = readJsonl(transcript_path);
  if (!events.length) return;

  let turns = 0, userMsgs = 0, toolErrors = 0, corrections = 0;
  const filesTouched = new Set();
  const editCount = new Map();
  const commands = new Set();
  const filtered = [];
  let branch = "", ts = "";

  for (const e of events) {
    if (e.gitBranch) branch = e.gitBranch;
    if (e.timestamp) ts = e.timestamp;
    const msg = e.message;
    if (!msg) continue;

    if (e.type === "assistant") {
      turns++;
      for (const b of msg.content || []) {
        if (b.type === "text") filtered.push({ role: "assistant", type: "text", text: cap(b.text, 2000) });
        else if (b.type === "tool_use") {
          const name = b.name || "tool";
          const inp = b.input || {};
          const fp = inp.file_path || inp.path;
          if (fp && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(name)) {
            filesTouched.add(sanitize(fp));
            editCount.set(fp, (editCount.get(fp) || 0) + 1);
          }
          if (name === "Bash" && inp.command) commands.add(cap(inp.command, 60));
          filtered.push({ role: "assistant", type: "tool_use", name, target: sanitize(fp || ""), cmd: name === "Bash" ? cap(inp.command || "", 120) : "" });
        }
      }
    } else if (e.type === "user") {
      if (e.isMeta) continue;
      const content = msg.content;
      // tool_result blocks come back as user-role; count errors, don't treat as prompts.
      if (Array.isArray(content) && content.some((b) => b?.type === "tool_result")) {
        for (const b of content) if (b?.type === "tool_result" && b.is_error) toolErrors++;
        continue;
      }
      const t = textOf(content).trim();
      if (!t) continue;
      userMsgs++;
      if (CORRECTION_RE.test(t)) corrections++;
      filtered.push({ role: "user", type: "text", text: cap(t, 2000) });
    }
  }

  let redoCount = 0;
  for (const n of editCount.values()) redoCount += n > 1 ? n - 1 : 0;

  let author = "unknown";
  try { author = execSync("git config user.name", { cwd: cwd || root }).toString().trim() || "unknown"; } catch { /* noop */ }

  const day = (ts || new Date().toISOString()).slice(0, 10);
  const short = String(session_id).slice(0, 8);
  const score = (turns >= 4 ? 1 : 0) + toolErrors + corrections + redoCount;

  mkdirSync(join(LOCAL, "signals"), { recursive: true });
  mkdirSync(join(LOCAL, "cache"), { recursive: true });
  writeFileSync(join(LOCAL, "cache", `${short}.filtered.jsonl`), filtered.map((o) => JSON.stringify(o)).join("\n") + "\n");

  const row = {
    session: short, day, ts: ts || "", branch, author,
    turns, user_msgs: userMsgs, files_touched: [...filesTouched],
    commands: [...commands], tool_errors: toolErrors,
    correction_markers: corrections, redo_count: redoCount,
    cache: join(".local", "cache", `${short}.filtered.jsonl`), score,
  };
  appendFileSync(join(LOCAL, "signals", `${day}.jsonl`), JSON.stringify(row) + "\n");
}

try { main(); } catch { /* best-effort: never break session shutdown */ }
