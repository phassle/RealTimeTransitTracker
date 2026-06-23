// Shared helpers for the reinforcement loop (Stage 0 capture + /distill + /reinforce).
// Co-located with the data these scripts operate on. Kept dependency-free.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Secrets we never want in a filtered cache or a committed candidate.
export const SECRET_RE =
  /(sk-(?:ant-)?[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|AKIA[0-9A-Z]{12,}|[\w.+-]+@[\w-]+\.[\w.-]+)/g;

// Strip $HOME / absolute user paths, and (by default) secrets. Secret-stripping
// is on by default so callers can't forget it.
export function sanitize(s, { secrets = true } = {}) {
  let out = String(s).replaceAll(homedir(), "~").replace(/\/Users\/[^/\s"']+/g, "~");
  if (secrets) out = out.replace(SECRET_RE, "[redacted]");
  return out;
}

// Parse a JSONL file → array of objects, skipping blank/garbage lines.
export function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean)
    .flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

// Concatenate every *.jsonl in a directory.
export function loadJsonlDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).flatMap((f) => readJsonl(join(dir, f)));
}

// decisions.jsonl is the machine-readable ledger (source of truth); DECISIONS.md
// is the human view. Each row: { sig, status, count, distinct_authors, ruling, run }.
const decisions = (rlDir) => readJsonl(join(rlDir, "decisions.jsonl"));

// Sigs already promoted or rejected → never reconsidered (idempotency guarantee).
export function ruledSigs(rlDir) {
  return new Set(decisions(rlDir).filter((r) => r.status === "promoted" || r.status === "rejected").map((r) => r.sig));
}

// Every sig the ledger has seen (any status) — feeds the distill vocabulary.
export function ledgerSigs(rlDir) {
  return new Set(decisions(rlDir).map((r) => r.sig).filter(Boolean));
}

// A sig is valid iff it's kebab-case, 3–48 chars.
export const isValidSig = (s) => /^[a-z0-9-]{3,48}$/.test(s || "");
