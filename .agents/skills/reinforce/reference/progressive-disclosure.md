# AGENTS.md refactor prompt (apply verbatim)

When `/reinforce` updates `AGENTS.md`, apply this exact prompt. The promoted
learnings (from the tally) are fed in as **candidate root rules / links** that
are subject to this same pass — so reinforcement routes each learning to the
right altitude (root vs `docs/` vs a skill) instead of bloating the root.

> Refactor my AGENTS.md to follow progressive disclosure.
> docs/
> 1. Find contradictions. Ask which to keep.
> 2. Extract essentials for the root: one-line description, package manager, build / typecheck, anything truly relevant to every task.
> 3. Keep the 2–3 most critical workflows in the root as numbered steps — they earn their place.
> 4. Group the rest into categories. One markdown file per category in docs/. Move procedural know-how into .agents/skills/<name>/SKILL.md.
> 5. Output a minimal root AGENTS.md linking each file with a one-line description. Replace code snippets with file:line refs.
> 6. Flag for deletion: redundant, vague, or overly obvious instructions.

## Applying it with reinforcement input

- Step 1 (contradictions): use **AskUserQuestion** when a promoted learning
  conflicts with an existing rule — ask which to keep; record the loser as
  `rejected` in `DECISIONS.md`.
- A promoted learning earns a **root** line only if it's relevant to *every*
  task (step 2/3). Otherwise route it to the right `docs/<category>.md` or a
  skill, and link it from the root map.
- `CLAUDE.md` is a **symlink** to `AGENTS.md` — edit `AGENTS.md` only; the mirror updates itself.
- Keep the root scannable: prefer a one-line link over inlined prose; use `file:line` refs over code snippets.
