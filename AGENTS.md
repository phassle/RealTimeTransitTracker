# RealTimeTransitTracker — Sweden Real-Time Transit Map

Real-time Leaflet map of Swedish public-transport vehicles, polled ~2s from Trafiklab GTFS-RT feeds (15 regional operators, fetched only when their region is in the viewport). Client-only SPA, no backend, cookieless (ADR 0001).

## Essentials (every task)

- **Package manager**: npm (`npm install`). **Runtime**: Node ≥20.19 (≥22.13 if using the Aspire AppHost).
- **Dev**: `npm run dev` → http://localhost:3000
- **Build**: `npm run build` (prod → `dist/`)
- **Typecheck**: `npm run typecheck` (= `vite build`)
- **Test**: `npm test` (Vitest single run; `test:watch` to watch). Tests sit beside the file (`*.test.js[x]`); `src/App.test.jsx` is excluded (`vite.config.js:16`). No e2e suite.

## Response style

- Be extremely concise. Sacrifice grammar for concision.
- End each plan with a list of unresolved questions.

## Critical workflows

**Never push to `main` or `develop` — always open a PR.** Branch protection requires it.

### Feature work
1. Branch off `develop` (git flow; `main` is release-only).
2. Read [CONTEXT.md](CONTEXT.md) (domain glossary — use its terms) + relevant [docs/adr/](docs/adr/).
3. Implement; verify in the browser via `npm run dev` (or the [observe-running-app](.agents/skills/observe-running-app/SKILL.md) skill).
4. `npm test` must pass; add tests beside the file. Code review before committing.
5. Open a PR into `develop` via the [create-pr](.agents/skills/create-pr/SKILL.md) skill — it runs the pre-PR gates.

### Pre-PR gates
1. `npm run build` succeeds (sourcemaps stay off — `vite.config.js:9-11`).
2. Security review — [docs/security-review.md](docs/security-review.md).
3. PR into `develop`; issues/PRDs via `gh` — [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

## Map (read on demand)

| File | What |
|------|------|
| [CONTEXT.md](CONTEXT.md) | domain glossary; Privacy Notice vs consent vs essential storage |
| [docs/architecture.md](docs/architecture.md) | tech stack, data flow, Command Center pipeline, key implementation facts |
| [docs/architectural_patterns.md](docs/architectural_patterns.md) | 15 recurring patterns with file:line anchors |
| [docs/environment.md](docs/environment.md) | env vars, API keys, rate limit, debug scripts |
| [docs/security-review.md](docs/security-review.md) | mandatory pre-PR security checklist |
| [docs/adr/](docs/adr/) | ADRs 0001–0006: cookieless, dark tiles, client-side incidents, webcam embeds, transient projections, ephemeral geolocation |
| [docs/agents/domain.md](docs/agents/domain.md) | how agents consume CONTEXT.md + ADRs |
| [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) | GitHub issue conventions via `gh` |
| [docs/agents/triage-labels.md](docs/agents/triage-labels.md) | triage label vocabulary |
| [research/](research/) | 8-part design docs (APIs, GTFS-RT, stack, multi-operator) |

### Skills — `.agents/skills/<name>/SKILL.md`

**Check this directory first** — 25 skills live here, each invokable via the Skill tool. Match the task to a skill's `description` before improvising. Project-specific:

- [add-operator](.agents/skills/add-operator/SKILL.md) — add a regional operator to the map
- [refresh-trip-mapping](.agents/skills/refresh-trip-mapping/SKILL.md) — rebuild the GTFS static trip mapping
- [create-pr](.agents/skills/create-pr/SKILL.md) — open a PR (asks base branch) with pre-PR gates
- [observe-running-app](.agents/skills/observe-running-app/SKILL.md) — see the running SPA's browser console/network via Aspire

Plus a general library in the same dir: engineering workflow (`tdd`, `diagnose`, `improve-codebase-architecture`, `prototype`, `handoff`), planning/issues (`to-prd`, `to-issues`, `triage`, `grill-me`, `grill-with-docs`), Aspire (`aspire`, `aspire-monitoring`, `aspire-orchestration`, `aspire-deployment`, `aspireify`, `aspire-init`), and authoring (`write-a-skill`, `teach`, `zoom-out`). Browse `.agents/skills/` for the full set.

## Data attribution

Trafiklab.se (GTFS-RT, CC-BY 4.0) · OpenStreetMap · CARTO (dark tiles)
