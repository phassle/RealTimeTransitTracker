---
name: create-pr
description: Create a pull request for the current branch — asks which base branch to target (the branch it was created from, main, or another), then runs the mandatory pre-PR checks (tests, build, security analysis). Use when the user wants to open/create a PR, says "skapa PR", "create PR", or is ready to ship the current branch.
argument-hint: "Optional: PR title or issue number to link (e.g. 'closes #47')"
---

# Create PR for current branch

Open a PR from the current branch, gated on the project's release checklist (CLAUDE.md → Release / PR).

## Preconditions

1. `git branch --show-current` — abort if on `main` (tell user to branch first).
2. `git status` — if uncommitted changes exist, ask whether to commit them first or proceed with what's committed.

## Choose base branch

1. Detect the branch this one was created from:
   - `git reflog show --no-abbrev <branch> | tail -1` — look for `branch: Created from <parent>`.
   - Fallback: branch whose merge-base with HEAD is newest (`git for-each-ref refs/heads --format='%(refname:short)'`, compare `git merge-base`).
2. Ask the user (AskUserQuestion) which base to target. Options:
   - Detected parent branch (Recommended) — mark it as "branchen du utgick från"
   - `main`
   - Other local/remote branches that look relevant (e.g. active `feature/*`)
   The user can always type another branch via "Other".
3. Skip the question only if detected parent IS `main` and `$ARGUMENTS` doesn't name a base.
4. Check branch has commits ahead of chosen base: `git log <base>..HEAD --oneline`. Abort if empty.

## Pre-PR gates (all mandatory, in order)

1. `npm test` — must pass.
2. `npm run build` — must succeed. Confirm sourcemaps stay off.
3. **Security analysis** (CLAUDE.md mandate) — check the diff (`git diff <base>...HEAD`) and build output for:
   - API key exposure in `dist/` bundle (grep for key values, not just var names)
   - XSS vectors: new `innerHTML`/popup paths; feed data must stay HTML-escaped (`Map.jsx:26-32` pattern)
   - Unsanitized external feed data
   - `npm audit` — report new high/critical findings
   - Secrets accidentally committed (`.env`, keys in source)

If any gate fails: stop, report, do not create the PR.

## Create the PR

1. `git push -u origin <branch>`.
2. Title: from `$ARGUMENTS` if given, else summarize the branch's commits.
3. Body must include:
   - Summary of changes (from `git log <base>..HEAD`)
   - `Closes #N` for related issues (check `$ARGUMENTS` and commit messages for issue refs; repo: `phassle/RealTimeTransitTracker`)
   - Test plan: which gates ran and their results, incl. the security analysis outcome
4. `gh pr create --base <base>` with title/body. Use a HEREDOC for the body.
5. Reply with the PR URL.
