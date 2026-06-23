---
name: dynamic-tdd
description: Build every open issue under a PRD automatically using a dynamic Workflow — plan (dependency graph) → parallel TDD implement in isolated worktrees → merge each issue branch into one feature branch → open a single PR into develop. Use when the user runs /dynamic-tdd <PRD#>, wants to auto-build a PRD's child issues, or asks to orchestrate issues with the Workflow tool / sandcastle-style flow.
---

# dynamic-tdd

Replaces the `.sandcastle` plan→implement→merge loop with the **Workflow tool**, integrating into a feature branch instead of pushing to trunk.

**Branch model:** `develop` → `feature/<prd-slug>` → per-issue worktrees (`dynamic-tdd/issue-<id>`) → merge each back into the feature branch → **one PR** `feature/<prd-slug>` → `develop`. Never push to `develop`/`main` directly (see CLAUDE.md).

Phase prompts live in [reference/](reference/) (`plan-prompt.md`, `implement-prompt.md`, `merge-prompt.md`) and are adapted from `.sandcastle/*-prompt.md`. The Workflow agents read and follow them.

## Run

1. **Resolve the PRD.** Take the number from `/dynamic-tdd <PRD#>`; if absent, ask. Read it and list its open children:
   ```bash
   gh issue view <PRD#> --json number,title,body
   gh issue list --state open --json number,title,body --jq '[.[] | select(.body | test("#<PRD#>")) | {number,title}]'
   ```
   If there are zero children, stop and tell the user.

2. **Confirm scope + branch name with the user** (this run will create commits and merges). Derive a slug from the PRD title → `feature/<prd-slug>`. Show the PRD, the child issues, and the branch name; get a go-ahead.

3. **Prep git** (must end on the feature branch in the main worktree — the merger and worktree bases depend on it):
   ```bash
   git fetch origin
   git switch -c feature/<prd-slug> origin/develop   # base off latest develop
   ```
   If the branch already exists, `git switch feature/<prd-slug>` and reuse it (the run is resumable — branch names are deterministic).

4. **Run the Workflow** (it loops plan→implement→merge until nothing is unblocked):
   ```
   Workflow({
     scriptPath: ".agents/skills/dynamic-tdd/scripts/dynamic-tdd.workflow.mjs",
     args: { prd: "<PRD#>", featureBranch: "feature/<prd-slug>", base: "develop", maxIterations: 10, maxParallel: 6 }
   })
   ```
   Wait for the `<task-notification>`; watch live with `/workflows`.

5. **Review, then open ONE PR.** Inspect the feature branch (`git log --oneline origin/develop..`, run `npm run build`). Then open the PR via the [create-pr](../create-pr/SKILL.md) skill with base `develop`. The PR body should list the issues built (and `Closes #<id>` for each so they close on merge).

## Notes

- **Isolation:** each implementer runs with `isolation: 'worktree'` so parallel agents never collide; they share the git object store, so the `dynamic-tdd/issue-<id>` branches are visible to the merger. The merger runs with **no** isolation (in the main worktree, on the feature branch).
- **Per-iteration incrementality:** later iterations branch off the feature branch's *current* HEAD, so issues unblocked by earlier merges build on top of them.
- **Issues are not closed mid-run** — completion happens when the single feature PR merges.
- **Cost:** one Opus planner + N Opus implementers (full TDD) + one merger per iteration. Scale `maxParallel`/`maxIterations` to the backlog; warn the user for large PRDs.
- **Resumable:** re-running with the same PRD reuses the feature branch and deterministic issue branches; the planner skips ids already merged.

## Unresolved questions

- Should the final feature→develop PR be opened automatically, or always left to the user? (Current: orchestrator opens it in step 5 after review.)
- Mono-PRD only — cross-PRD batching isn't handled.
