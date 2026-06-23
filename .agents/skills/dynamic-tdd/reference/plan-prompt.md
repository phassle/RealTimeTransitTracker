# ISSUES

You are planning a TDD build of **PRD #{{PRD}}**. Discover its open child work-issues:

<issues-json>

```
gh issue view {{PRD}} --json number,title,body
gh issue list --state open --json number,title,body,labels,comments \
  --jq '[.[] | select(.body | test("#{{PRD}}")) | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'
```

A work-issue belongs to this PRD when its body references `#{{PRD}}` (e.g. a `## Parent` section: `#{{PRD}} — …`).

</issues-json>

Exclude any issue ids already attempted this run: **{{DONE}}**.

# TASK

Analyze the open child issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open child issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open child issues.

For each unblocked issue, assign a branch name using the exact format `dynamic-tdd/issue-{id}` (no slug or other suffix). This must be deterministic so that re-planning the same issue always produces the same branch name and accumulated progress is preserved.

# OUTPUT

Return your plan via the **structured-output tool** as `{ "issues": [ { "id", "title", "branch" } ] }`. (This supersedes any `<plan>` tag convention — emit the structured object, not tags.)

Include only **unblocked** issues. If every issue is blocked, include the single highest-priority candidate (the one with the fewest or weakest dependencies). If there is nothing to work on at all, return `{ "issues": [] }` so the run can exit cleanly.
