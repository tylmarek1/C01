#!/usr/bin/env bash
# Structural check for the docs/course + docs/project-state.md + .claude/workflows
# system (see root CLAUDE.md's "Source-of-truth hierarchy" and
# docs/definition-of-done.md). This checks that the SCAFFOLDING is intact —
# required files exist, workflows are present, CLAUDE.md hasn't absorbed a
# copy of the course text. It does NOT check requirements content or gate
# correctness; only reading docs/course/ against docs/project-state.md does
# that. Exit 0 = structure intact, exit 1 = something is missing/broken.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

fail=0
warn() { echo "WARN: $1"; }
err()  { echo "FAIL: $1"; fail=1; }
ok()   { echo "OK:   $1"; }

# 1. Course source-of-truth files exist and are non-trivial.
if [ -d docs/course ]; then
  found_any=0
  for f in docs/course/*.md; do
    [ -e "$f" ] || continue
    found_any=1
    size=$(wc -c < "$f")
    if [ "$size" -lt 500 ]; then
      err "$f exists but is suspiciously small ($size bytes) — looks like a stub, not a real assignment"
    else
      ok "$f present ($size bytes)"
    fi
  done
  [ "$found_any" -eq 1 ] || err "docs/course/ exists but has no .md files"
else
  err "docs/course/ does not exist — no course source-of-truth"
fi

# 2. Core state/DoD files exist.
for f in docs/project-state.md docs/definition-of-done.md; do
  if [ -f "$f" ]; then ok "$f present"; else err "$f is missing"; fi
done

# 3. Expected workflow files exist.
for f in c01 c02-baseline c02-change feature bug-fix improve-app release; do
  path=".claude/workflows/${f}.md"
  if [ -f "$path" ]; then ok "$path present"; else err "$path is missing"; fi
done

# 4. CLAUDE.md must not have absorbed a copy of the course text — a few
#    phrases that only appear in the actual assignment wording, not in a
#    reference to it.
if [ -f CLAUDE.md ]; then
  if grep -qE "Definice hotového|Povinný výstup do C0[0-9]" CLAUDE.md; then
    err "CLAUDE.md appears to contain course assignment text directly — it must only reference docs/course/, never copy it (see root CLAUDE.md's source-of-truth hierarchy)"
  else
    ok "CLAUDE.md does not appear to duplicate course assignment text"
  fi
fi

# 5. Every backtick-quoted, slash-containing path mentioned in
#    docs/project-state.md should exist on disk. Best-effort: skips
#    anything that isn't a plausible relative repo path.
if [ -f docs/project-state.md ]; then
  missing=0
  while IFS= read -r p; do
    case "$p" in
      http*|*\**|*\ *|*.md#*) continue ;;  # skip URLs, globs, anchors, text with spaces
    esac
    if [ -n "$p" ] && [ ! -e "$p" ]; then
      warn "docs/project-state.md references '$p', which does not exist on disk"
      missing=1
    fi
  done < <(grep -oE '`[A-Za-z0-9_./-]+/[A-Za-z0-9_./-]+`' docs/project-state.md | tr -d '`' | sort -u)
  [ "$missing" -eq 0 ] && ok "all path-like references in docs/project-state.md resolve"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "check-project-state: structure OK"
else
  echo "check-project-state: FAILED — see FAIL lines above"
fi
exit "$fail"
