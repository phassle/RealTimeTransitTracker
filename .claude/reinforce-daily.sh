#!/usr/bin/env bash
# Reinforcement loop — daily check (SessionStart hook). Cheap, non-blocking:
# prints a short reminder to stdout (added to session context) if /distill or
# /reinforce is due today. Does NOT run them — the user runs the slash command.
set -euo pipefail

# Don't fire inside a headless reinforcement child.
[ "${CLAUDE_REINFORCE_CHILD:-}" = "1" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
checker="$root/.claude/reinforce-daily.mjs"

[ -f "$checker" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

node "$checker" "$root" || true
exit 0
