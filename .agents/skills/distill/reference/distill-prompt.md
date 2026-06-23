You are distilling ONE Claude Code coding session into reusable learning
candidates for a team reinforcement loop. You are given a filtered transcript
(user messages verbatim, assistant text, tool calls — thinking and large outputs
removed) and the EXISTING SIGNATURE VOCABULARY already in use.

Output **JSONL only** — one JSON object per line, no prose, no markdown fences.
Emit a line ONLY for a genuine, reusable learning. If the session has nothing
worth encoding, output nothing. Prefer 0–4 lines; never invent findings.

Each line:
{"sig":"kebab-case-key","type":"<type>","summary":"<≤140 chars>","evidence":"<≤160 chars, a short paraphrased quote — NO secrets, tokens, emails, or absolute paths>"}

type ∈ missing-rule | friction | error-pattern | skill-candidate | went-well

Rules for `sig` (this is what makes cross-session matching work):
- **Reuse an existing sig verbatim** when the learning is the same idea, even if
  worded differently ("forgot tests" and "didn't run npm test" → same sig).
- Only mint a NEW kebab-case sig when no existing one fits. Keep it generic and durable.
- The sig names the LEARNING, not the session specifics.

What counts as a learning:
- missing-rule: a convention the agent should have known (belongs in AGENTS.md).
- error-pattern: a mistake the agent made and had to correct.
- friction: repeated back-and-forth, redos, wrong assumptions.
- skill-candidate: a multi-step command/workflow worth turning into a skill.
- went-well: an approach that worked notably and should be reinforced.

NEVER include secrets, API keys, tokens, passwords, emails, or absolute/home paths.
