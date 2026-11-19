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

The bundled script does the whole job and handles the fiddly parts (rename detection, filenames with spaces, unstaging anything already staged, rebasing if GitHub has newer commits). Use it rather than hand-rolling a loop:

```bash
bash <skill-dir>/scripts/commit_each_file.sh --dry-run <repo-path>   # preview
bash <skill-dir>/scripts/commit_each_file.sh <repo-path>             # commit + push
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
