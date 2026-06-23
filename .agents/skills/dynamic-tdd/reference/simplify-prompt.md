# TASK

You are in the main worktree on branch `{{FEATURE_BRANCH}}`. All issue branches for **PRD #{{PRD}}** have been merged in. Do a focused simplification pass over **only the code this feature branch changed** relative to `{{BASE}}`.

If the project has a `simplify` skill, follow it. Otherwise apply its intent directly.

# SCOPE

Limit yourself to the changed files:

```
git diff --name-only origin/{{BASE}}...{{FEATURE_BRANCH}}
```

Review them for: duplication / missed reuse, dead code, unnecessary complexity, inefficiency, and wrong altitude (logic living in the wrong layer). Apply only **safe, behaviour-preserving** cleanups.

Do **not**:

- change behaviour or public APIs,
- touch files outside the changed set,
- "improve" code unrelated to this PRD's slices.

# GATE

After each cleanup run `npm run typecheck` and `npm test`. Both must stay green — revert any change that breaks them.

# COMMIT

If you made changes, commit them on `{{FEATURE_BRANCH}}`:

```
RALPH: simplify pass (PRD #{{PRD}})
```

…summarizing what you consolidated. If nothing genuinely needed simplifying, make **no** commit and say so. Do not push. Report what you changed (or that you changed nothing and why).
