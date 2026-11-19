#!/usr/bin/env bash
# Commit every changed file in a git repo as its own commit, then push once.
#
# Usage: commit_each_file.sh [--dry-run] [--no-push] [--branch main] [--remote origin] [repo-path]
#
# Message template (one commit per change git detects):
#   Add <path>                 new file
#   Update <path>              modified file (content, mode or type change)
#   Delete <path>              deleted file
#   Rename <old> to <new>      renamed / moved file (one commit covers both paths)
#   Copy <old> to <new>        copy detected by git (commits only the new path)

set -euo pipefail

BRANCH="main"
REMOTE="origin"
DRY_RUN=0
PUSH=1
REPO="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-push) PUSH=0 ;;
    --branch) BRANCH="$2"; shift ;;
    --remote) REMOTE="$2"; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) REPO="$1" ;;
  esac
  shift
done

cd "$REPO"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERROR: $REPO is not a git repository" >&2; exit 2; }
cd "$(git rev-parse --show-toplevel)"

# Refuse mid-merge/rebase states and conflicts: splitting those up would be wrong.
GIT_DIR="$(git rev-parse --git-dir)"
for f in MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do
  [[ -e "$GIT_DIR/$f" ]] && { echo "ERROR: a merge/rebase/cherry-pick is in progress; finish it first" >&2; exit 2; }
done
[[ -d "$GIT_DIR/rebase-merge" || -d "$GIT_DIR/rebase-apply" ]] && { echo "ERROR: a rebase is in progress; finish it first" >&2; exit 2; }
if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: there are unresolved merge conflicts" >&2; exit 2
fi

CURRENT="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ "$CURRENT" != "$BRANCH" ]]; then
  echo "ERROR: on branch '${CURRENT:-<detached HEAD>}', expected '$BRANCH'. Switch branches first (or pass --branch)." >&2
  exit 2
fi

# Build the list of changes with rename detection: stage everything, read the
# staged diff, then unstage so each change can be committed on its own.
HAS_HEAD=1
git rev-parse --verify --quiet HEAD >/dev/null || HAS_HEAD=0

git add -A
if [[ $HAS_HEAD -eq 1 ]]; then
  mapfile -d '' FIELDS < <(git diff --cached --name-status -M -z)
  git reset -q
else
  # Brand-new repo with no commits yet: everything is an "Add".
  mapfile -d '' FIELDS < <(git diff --cached --name-status -z)
  git rm -r -q --cached . >/dev/null 2>&1 || true
fi

# Parse into parallel arrays: status, path1, path2
STATUS=(); P1=(); P2=()
i=0
while [[ $i -lt ${#FIELDS[@]} ]]; do
  s="${FIELDS[$i]}"; i=$((i+1))
  case "${s:0:1}" in
    R|C) STATUS+=("${s:0:1}"); P1+=("${FIELDS[$i]}"); P2+=("${FIELDS[$((i+1))]}"); i=$((i+2)) ;;
    *)   STATUS+=("${s:0:1}"); P1+=("${FIELDS[$i]}"); P2+=(""); i=$((i+1)) ;;
  esac
done

TOTAL=${#STATUS[@]}
if [[ $TOTAL -eq 0 ]]; then
  echo "Nothing to commit: working tree is clean."
  exit 0
fi

echo "Found $TOTAL change(s) to commit individually on '$BRANCH':"
COMMITTED=0
for idx in "${!STATUS[@]}"; do
  s="${STATUS[$idx]}"; a="${P1[$idx]}"; b="${P2[$idx]}"
  case "$s" in
    A) msg="Add $a";            paths=("$a") ;;
    D) msg="Delete $a";         paths=("$a") ;;
    R) msg="Rename $a to $b";   paths=("$a" "$b") ;;
    C) msg="Copy $a to $b";     paths=("$b") ;;
    *) msg="Update $a";         paths=("$a") ;;   # M, T and anything else
  esac

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  [dry-run] $msg"
    continue
  fi

  git add -A -- "${paths[@]}"
  if git diff --cached --quiet; then
    echo "  (skipped, nothing staged) $msg"
    continue
  fi
  git commit -q -m "$msg" -- "${paths[@]}"
  COMMITTED=$((COMMITTED+1))
  echo "  committed: $msg"
done

[[ $DRY_RUN -eq 1 ]] && { echo "Dry run only: no commits made, nothing pushed."; exit 0; }

echo "Made $COMMITTED commit(s)."

if [[ $PUSH -eq 1 && $COMMITTED -gt 0 ]]; then
  if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
    echo "ERROR: no remote named '$REMOTE'; commits were made locally but not pushed." >&2
    exit 3
  fi
  # If GitHub has commits we don't, rebase ours on top (keeps one commit per file, no merge commit).
  if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
    git fetch -q "$REMOTE" "$BRANCH"
    if ! git merge-base --is-ancestor "$REMOTE/$BRANCH" HEAD; then
      echo "Remote '$BRANCH' has new commits; rebasing local commits on top..."
      git rebase -q "$REMOTE/$BRANCH" || { echo "ERROR: rebase hit conflicts. Resolve them, then 'git rebase --continue' and push." >&2; exit 4; }
    fi
  fi
  git push -q "$REMOTE" "HEAD:$BRANCH"
  echo "Pushed $COMMITTED commit(s) to $REMOTE/$BRANCH."
fi
