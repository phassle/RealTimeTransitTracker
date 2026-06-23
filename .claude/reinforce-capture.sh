#!/usr/bin/env bash
# Reinforcement loop — Stage 0 capture (SessionEnd hook).
# Deterministic, zero-token: parses the session transcript into a compact signal
# row + a filtered local transcript cache. All heavy/LLM work happens later in
# the /distill skill. Must never break session shutdown → always exits 0.
#
# Reads the SessionEnd hook JSON (with transcript_path) on stdin and forwards it
# to the Node parser. See .claude/reinforce-capture.mjs.
set -euo pipefail

# Recursion guard: a headless `claude -p --bare` child already skips hooks, but
# this is belt-and-suspenders in case --bare is ever dropped.
[ "${CLAUDE_REINFORCE_CHILD:-}" = "1" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
parser="$root/.claude/reinforce-capture.mjs"

[ -f "$parser" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

# Never let a parser failure surface as a hook error.
node "$parser" "$root" || true
exit 0
