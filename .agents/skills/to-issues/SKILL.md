---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices. Use when user wants to convert a plan into issues, create implementation tickets, or break down work into issues.
---

# To Issues

Break a plan into independently-grabbable issues using vertical slices (tracer bullets).

The issue tracker and triage label vocabulary should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference (issue number, URL, or path) as an argument, fetch it from the issue tracker and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

#### A slice IS a behavior — author the scenario first

The tracer bullet (Hunt & Thomas, *The Pragmatic Programmer*) and the executable specification (Dan North's BDD; Gojko Adzic, *Specification by Example*) are the same cut from two angles: **a vertical slice is a behavior, and a behavior is a Gherkin scenario.** Slicing the PRD and writing acceptance scenarios are one act. The scenario defines where the slice cuts — not the other way around.

So when you draft each slice, **write its acceptance criteria as executable Gherkin**:

- `Feature:` names the slice.
- `Scenario:` / `Given`–`When`–`Then` describe behavior end-to-end through all layers, in the project's domain vocabulary — not implementation steps.
- Use `Scenario Outline:` + `Examples:` tables for edge cases and data/value variations.
- **Every issue must have at least one happy-path scenario AND one failure/edge scenario.** No issue without both. If you cannot name a failure path, the slice is probably too thin to be a tracer bullet — or you don't understand it yet.

**Trace every scenario back to a PRD user story.** A scenario that no story covers is a requirement you are inventing — *stop and flag it to the user* rather than writing it. Keeping scope honest with the stories is the whole point of specification by example.

Gherkin is embedded directly in the issue body — no `.feature` files are created or committed.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first, stated as a **scenario dependency** — name the `Given` precondition the blocker's scenario establishes (see step 5)
- **User stories covered**: which user stories this addresses (every scenario must trace to one)
- **Scenarios**: the scenario titles (happy-path + failure/edge), so granularity is judged on behavior, not vibes
- **Complexity hint**: a one-line triage signal (see below)

**Complexity hint (triage signal).** Derive a routing hint mechanically from the scenario shape, so a downstream `/triage` step can route it. This is a *complexity* signal only — `/triage` applies its own data-sensitivity gate on top and may escalate it (a low-complexity slice touching PII still needs a human). Heuristic:

- `AGENT-AUTO` — 1–2 scenarios, ≤1 failure path, no/small `Examples` table (≤3 rows). Mechanical, low branching.
- `PAIRED` — 3–4 scenarios, multiple failure paths, or an `Examples` table of 4–8 rows. Worth a human reviewing the agent's PR.
- `HUMAN-FIRST` — 5+ scenarios, heavy branching/`Examples`, or any HITL slice (architectural/design judgment).

Format: `complexity: <AGENT-AUTO|PAIRED|HUMAN-FIRST> (N scenarios, F failure paths, E examples rows)`.

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?
- Does every scenario trace to a user story?

Iterate until the user approves the breakdown.

### 5. Publish the issues to the issue tracker

For each approved slice, publish a new issue to the issue tracker. Use the issue body template below. Embed the Gherkin directly in the issue body — do not create or commit `.feature` files. These issues are considered ready for AFK agents, so publish them with the correct triage label unless instructed otherwise.

Publish issues in dependency order (blockers first) so you can reference real issue identifiers in the "Blocked by" field.

<issue-template>
## Parent

A reference to the parent issue on the issue tracker (if the source was an existing issue, otherwise omit this section).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Acceptance scenarios

Executable Gherkin — these scenarios ARE the acceptance criteria. The slice is done only when every scenario is green.

```gherkin
Feature: <slice title>

  Scenario: <happy path title>
    Given ...
    When ...
    Then ...

  Scenario: <failure/edge title>
    Given ...
    When ...
    Then ...
```

- ✅ happy path: `<Scenario title>`
- ⚠️ failure/edge: `<Scenario title>`
- (any `Scenario Outline` + `Examples` variations)

**User stories covered:** every scenario above traces to a PRD user story — list them.

## How to implement — outside-in TDD

Treat the Gherkin scenarios above as the **outer (acceptance) loop** and red-green-refactor as the **inner (unit) loop** — double-loop / outside-in TDD. Pick one failing scenario, drive it green through unit-level red-green-refactor cycles, then move to the next. Hand off to `/tdd` for the inner loop. The slice is complete only when **all** scenarios pass.

## Triage hint

`complexity: <AGENT-AUTO|PAIRED|HUMAN-FIRST> (N scenarios, F failure paths, E examples rows)` — a complexity signal for `/triage`, which may escalate it on data-sensitivity grounds.

## Blocked by

State the dependency in **behavioral terms**: name the `Given` precondition this slice's scenarios assume, and the blocking issue whose scenarios establish that state. E.g. *"Blocked by #41 — this slice's `Given a dismissed privacy notice` is the end state of #41's `Scenario: user dismisses the privacy notice`."*

Or "None - can start immediately" if no blockers.

</issue-template>

Do NOT close or modify any parent issue.
