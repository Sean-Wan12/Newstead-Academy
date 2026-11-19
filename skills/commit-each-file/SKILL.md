---
name: commit-each-file
description: Commit every changed file in a git repo as its own separate commit on main, then push them all to GitHub in one push, so GitHub's history shows exactly one commit per file. Use this whenever the user asks to push, commit, sync or upload their changes and wants them file-by-file, "one commit per file", "each file separately", "individually", or says "push my changes the usual way" in a repo where this is their habit, even for tiny one-character edits, new files, deletions or renames.
---

# Commit each file

The user wants their GitHub history to show one commit for every file that changed, however small the change. Bundling several files into one commit defeats the point, even if they look related, so never group them, and never skip a file because its change looks trivial (whitespace, a single character, a mode change all count).

## What the commits look like

Messages follow a fixed template, chosen by the user so the history is predictable. Don't write custom summaries:

| Change | Message |
|---|---|
| New file | `Add <path>` |
| Edited file | `Update <path>` |
| Deleted file | `Delete <path>` |
| Renamed or moved file | `Rename <old> to <new>` (one commit covers both paths) |

Paths are relative to the repo root. All commits are made locally first, then pushed to `main` in a single push. GitHub still lists every commit separately, and CI runs once instead of once per file.

## How to do it

The script at the end of this file does the whole job and handles the fiddly parts (rename detection, filenames with spaces, unstaging anything already staged, rebasing if GitHub has newer commits). Use it rather than hand-rolling a loop. Write it out once per session to a scratch location outside the repo (so it never gets committed itself), e.g. `/tmp/commit_each_file.sh`, then:

```bash
bash /tmp/commit_each_file.sh --dry-run <repo-path>   # preview
bash /tmp/commit_each_file.sh <repo-path>             # commit + push
```

1. **Preview first.** Run with `--dry-run` and show the user the list of commits it would make, unless they've already told you to just go ahead. This is the moment to catch a file that shouldn't be pushed at all.
2. **Watch for files that shouldn't go to GitHub.** If the preview includes something that looks like a secret (`.env`, `credentials.json`, private keys, tokens) or a large build artifact, stop and ask before committing it. Once pushed, a secret is in the history for good.
3. **Run it for real**, then report how many commits were pushed and to where. Include the commit lines the script printed if the list is short; summarize if it's long.

Options: `--branch <name>` if their main branch is called something else (e.g. `master`), `--remote <name>` if the remote isn't `origin`, `--no-push` to commit locally only.

## When the script stops

It exits with a clear message instead of guessing in these cases. Relay the message in plain words and help fix the cause:

- **Not on `main`**: ask whether to switch to main (and what to do with the current branch's changes) or to use `--branch`. Don't switch branches on your own; uncommitted changes could be carried over or conflict.
- **Merge, rebase or conflict in progress**: these need to be finished first; splitting a half-done merge into per-file commits would corrupt it.
- **Rebase conflicts while catching up with GitHub**: someone pushed changes to the same files. Show which files conflict and help resolve them, then `git rebase --continue` and `git push origin HEAD:main`.
- **Push rejected for authentication**: the commits are safe locally; help the user sign in (e.g. `gh auth login`) and push again with `git push origin HEAD:main`. Don't redo the commits.
- **Nothing to commit**: tell the user the working tree is already clean.

## Doing it by hand

If the script can't run (no bash, say), follow the same logic: stage everything with `git add -A`, read `git diff --cached --name-status -M`, unstage with `git reset`, then for each line `git add -A -- <path(s)>` and `git commit -m "<template message>" -- <path(s)>`, and finally `git push origin HEAD:main`.

## The script

```bash
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
```
