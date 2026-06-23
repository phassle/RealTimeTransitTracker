# TASK

You are in the main worktree on the **feature branch `{{FEATURE_BRANCH}}`**. Merge the following branches into it:

{{BRANCHES}}

For each branch, **one at a time, in order**:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct combined behavior
3. After resolving conflicts, run `npm run typecheck` and `npm test` to verify everything works
4. If tests fail, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge if one is needed.

# DO NOT CLOSE ISSUES

Unlike a direct-to-trunk flow, this build integrates into a feature branch. **Do not close any issue here** — the issues are completed when the single feature PR (`{{FEATURE_BRANCH}}` → `{{BASE}}`) is merged later by the orchestrator.

Here are the issues whose branches you merged (for reference only):

{{ISSUES}}

# CONSTRAINTS

- Do **not** push.
- Do **not** merge into `{{BASE}}`, `develop`, or `main` — only into `{{FEATURE_BRANCH}}`.

When you've merged everything you can, report which branches merged cleanly and any you had to skip (with the reason).
