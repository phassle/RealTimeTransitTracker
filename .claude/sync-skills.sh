#!/usr/bin/env bash
# Sync project skills into .claude/skills/ so Claude (which loads skills from
# .claude/skills/) sees every skill authored under .agents/skills/.
# Idempotent: adds missing relative symlinks, prunes dangling ones. Run on SessionStart.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
src="$root/.agents/skills"
dst="$root/.claude/skills"

[ -d "$src" ] || exit 0
mkdir -p "$dst"

# Add a relative symlink for every skill that lacks one.
for d in "$src"/*/; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  link="$dst/$name"
  if [ ! -e "$link" ] && [ ! -L "$link" ]; then
    ln -s "../../.agents/skills/$name" "$link"
  fi
done

# Prune symlinks into .agents/skills/ whose target no longer exists.
for link in "$dst"/*; do
  [ -L "$link" ] || continue
  case "$(readlink "$link")" in
    *".agents/skills/"*) [ -e "$link" ] || rm -f "$link" ;;
  esac
done

exit 0
