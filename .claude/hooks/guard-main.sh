#!/usr/bin/env bash
# PreToolUse guard: block `git commit` / `git push` while `main` is checked
# out, so a change that skipped branching fails loudly instead of landing
# directly on main. See root CLAUDE.md's "Git workflow" section.
set -euo pipefail

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0

case "$cmd" in
  *"git commit"*|*"git push"*)
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [ "$branch" = "main" ]; then
      echo "Blocked: refusing to '$cmd' while 'main' is checked out. Create a feature branch first (feat/..., fix/..., refactor/..., docs/..., chore/...) per CLAUDE.md's Git workflow, e.g.: git checkout -b feat/<short-desc>" >&2
      exit 2
    fi
    ;;
esac

exit 0
