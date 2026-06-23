# TASK

You are on branch `{{FEATURE_BRANCH}}` with **PRD #{{PRD}}**'s slices merged and simplified. Verify the change actually **works at runtime** — not just that tests pass.

**Run it in Aspire.** Use the `observe-running-app` skill (Aspire AppHost) — that is how this project observes real browser console / network / JS errors, not just Vite stdout.

1. Build: `npm run build` must succeed.
2. Launch the SPA via **Aspire** (`observe-running-app` skill / `aspire start`) and confirm it **boots** and the GTFS-RT polling runs.
3. **Verify the web logs.** Inspect the **browser console logs** captured by Aspire (browser-log capture / the Aspire dashboard). The change is only verified if the web logs show **no new errors or warnings** introduced by the merged slices. Quote the relevant log lines (or confirm they are clean) in your verdict.
4. For each merged issue, exercise the behaviour it introduced (per the issue's acceptance criteria) and confirm it appears and behaves correctly in the running app, watching the web logs as you do.
5. **Browser tests from the issues.** Read each merged issue (`gh issue view <id> --comments`). If an issue specifies tests or acceptance checks that must be **run in the browser / web** (manual steps, Playwright/e2e scenarios, "verify in the UI that…"), **run them now** against the Aspire-launched app — use the `playwright-cli` skill for scripted browser steps, or drive the UI manually and observe. Report each browser test and its result (pass/fail) in the verdict. A failing browser test means overall `FAIL`.

# OUTPUT

Report a concise **VERDICT**: what you checked, what passed, and any runtime problems found. State `PASS` or `FAIL` overall.

Do **not** commit and do **not** push. If you find a real runtime regression, describe it precisely (steps, expected vs actual) so the orchestrator can decide whether to fix before opening the PR.
