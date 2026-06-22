# RealTimeTransitTracker — Sweden Real-Time Transit Map

Real-time Leaflet map of Swedish public transport vehicles, polled every ~2s from Trafiklab GTFS-RT feeds. Covers 15 regional operators (SL, Skånetrafiken, UL, …); operators are fetched only when their region is in the viewport. Client-only SPA, no backend, cookieless (Privacy Notice, no consent gate — see ADR 0001).

## Response Style

- Be extremely concise. Sacrifice grammar for concision.
- At the end of each plan, list unresolved questions.

## Tech Stack (WHAT)

| Layer | Technology |
|-------|-----------|
| UI | React 19, JSX |
| Build | Vite 7, ES modules (`"type": "module"`) |
| Map | Leaflet 1.9 — OSM tiles (light) / CartoDB Dark Matter (dark) |
| Data | GTFS-RT protobuf via Trafiklab, decoded with gtfs-realtime-bindings |
| Tests | Vitest + Testing Library, jsdom (`vite.config.js:12-17`) |
| Runtime | Node.js 18+ |

## Data Flow (WHY it's shaped this way)

```
Trafiklab GTFS-RT per-operator feeds (protobuf) + /data/trip-mapping.json (static, prebuilt)
  → src/services/trafiklab.js        parse, map route_type → mode, enrich line names
    → src/hooks/useRealtimeVehicles.js  poll, adaptive interval, tab-visibility pause
      → src/App.jsx                  owns all state; filters by mode/line/viewport
        → src/components/Map.jsx     marker lifecycle (reuse, not recreate)
        → src/components/ControlPanel.jsx  filters, stats, theme toggle
```

State lives only in `App.jsx`; components are presenters; all I/O is behind the hook + service. See [docs/architectural_patterns.md](docs/architectural_patterns.md) before deviating.

**Command Center** (additive second view, toggled in `App.jsx:86-104`; the map view is untouched — PRD #84, ADR 0003). Derives an operational picture from the polling the app already does — zero new feed calls, all in-memory (ADR 0001):

```
vehicles + per-operator fetch outcomes (each poll)
  → services/observationBuffer.js   rolling ~30 min window; Recording export/import (versioned envelope)
    → services/anomalyRules.js       stationary-on-active-trip + learnDwellSpots (suppress habitual stops)
    → services/feedOutageRules.js    fetch-fail / frozen-timestamps / vehicle-count-collapse → operator-subject Anomalies
      → services/incidentClustering.js  Anomalies → Incidents (time+space / operator); lifecycle, stale-freeze, cross-rule merge, demo marker
        → hooks/useIncidents.js      owns the pipeline + replay/inject/recording/verify; injectedIncident.js seeds demo via same seam
          → components/CommandCenter.jsx  inbox + map + detail (Why-flagged evidence, timeline, nearby webcams), Replay, FeedStatus
```

Anomaly carries structured **evidence** only (rule, threshold, measured value, refs, timestamps) — presenters render text, rules never do. **Injected Incidents** enter through the same `clusterIncidents` seam, demo-labelled on every surface. **nearbyWebcams.js** ranks the curated webcam list by distance (traffic cameras first); webcam embed boundary is ADR 0004. Glossary: CONTEXT.md § Operational picture.

## Commands (HOW)

```bash
npm install
npm run dev                          # http://localhost:3000
npm test                             # vitest run (test:watch for watch mode)
npm run build                        # production build → dist/
npm run preview                      # serve dist/
node test-api.js                     # API connectivity check
node explore-routes.js               # inspect raw GTFS-RT entities
node find-buses.js                   # list active bus lines
node scripts/build-trip-mapping.js   # rebuild public/data/trip-mapping.json
```

## Environment

`.env` (see `.env.example`). `VITE_`-prefixed keys are bundled into the client.

| Variable | Used by | Purpose |
|----------|---------|---------|
| `VITE_TRAFIKLAB_API_KEY` | `src/services/trafiklab.js:3` | GTFS-RT realtime feeds |
| `GTFS_REGIONAL_API_KEY` | `scripts/build-trip-mapping.js:164` | GTFS static download |

Keys from https://developer.trafiklab.se/. Rate limit: Bronze, 50 calls/min — polling auto-scales to N operators × 2s (`src/hooks/useRealtimeVehicles.js:14-17`) to stay under it.

## Key Implementation Facts

- **Vehicle shape** (`src/services/trafiklab.js:95-109`): `{ id, operator, routeId, line, lineName, mode, latitude, longitude, bearing, speed, timestamp, tripId, direction }`
- **Modes**: metro, bus, train, tram, ship, ferry, unknown. GTFS `route_type` → mode map: `src/services/trafiklab.js:8-28`. Colors duplicated in `src/components/Map.jsx:6-14` and `src/components/ControlPanel.jsx:4-12` — change both.
- **Operator registry** (slug, center, bounding box): `src/config/operators.js:1-17`; viewport → operators: `src/config/operators.js:29-37`
- **Feed URL**: `opendata.samtrafiken.se/gtfs-rt-sweden/<slug>/VehiclePositionsSweden.pb` (`src/services/trafiklab.js:56-58`); per-operator failures tolerated via `Promise.allSettled` (`trafiklab.js:121-133`)
- **Theme**: OS preference + localStorage override (`src/hooks/useTheme.js`), tile provider swap (`src/components/tileLayerConfig.js`, ADR 0002)
- **Performance**: `preferCanvas` (`Map.jsx:55-57`), marker reuse (`Map.jsx:115-179`), memoized filtering (`App.jsx:28-61`)
- **Security**: external feed data is HTML-escaped before popup injection (`Map.jsx:26-32`) — keep it that way
- **Command Center pipeline**: pure services (`observationBuffer`, `anomalyRules`, `feedOutageRules`, `incidentClustering`, `injectedIncident`, `nearbyWebcams`) behind `hooks/useIncidents.js`; the highest-value test seam is `incidentClustering.test.js`. Incident **subject** is discriminated: geographic area vs operator (feed outage = operator, no ground geometry). All command-center state is in-memory; Recordings are files on disk, never client storage (ADR 0001/0003).

## Critical Workflows

**Never push directly to `main` or `develop` — always open a PR first, even for one-line fixes.** Branch protection requires changes via PR; do not bypass it. Commit to a feature/fix branch, run the pre-PR gates, open a PR.

### Feature work
1. Branch off `main` (always; git flow).
2. Read `CONTEXT.md` (domain glossary — use its terms) and relevant `docs/adr/`.
3. Implement; `npm run dev` to verify in browser.
4. `npm test` — must pass. Add tests beside the file (`*.test.js[x]`). Note: `src/App.test.jsx` is excluded (`vite.config.js:16`).
5. Run code review before committing.

### Test
1. `npm test` (CI-style single run) or `npm run test:watch`.
2. No e2e suite — validate data plumbing with `node test-api.js` / `explore-routes.js` and browser smoke-test.

### Release / PR
1. `npm run build` — must succeed; sourcemaps are off (`vite.config.js:9-11`), keep them off.
2. **Mandatory security analysis**: API key exposure in bundle, XSS vectors (popup/innerHTML paths), unsanitized feed data, `npm audit`, CSP/headers, secrets in build output.
3. PR to `main`. Issues live at `phassle/RealTimeTransitTracker` via `gh` (see docs index).

## Docs Index (read on demand, not upfront)

- [CONTEXT.md](CONTEXT.md) — domain glossary; Privacy Notice vs Consent vs essential storage distinctions
- [docs/architectural_patterns.md](docs/architectural_patterns.md) — 15 recurring patterns with file:line anchors
- [docs/adr/0001-cookieless-no-consent-popup.md](docs/adr/0001-cookieless-no-consent-popup.md) — why Privacy Notice, no cookie banner
- [docs/adr/0002-dark-mode-tile-provider.md](docs/adr/0002-dark-mode-tile-provider.md) — why CartoDB Dark Matter for dark tiles
- [docs/adr/0003-client-side-incident-derivation.md](docs/adr/0003-client-side-incident-derivation.md) — why the Command Center derives everything client-side, no backend
- [docs/adr/0004-webcam-layer-static-images-no-embeds.md](docs/adr/0004-webcam-layer-static-images-no-embeds.md) — webcam embed boundary (hotlinked stills, no third-party embeds)
- [docs/adr/0005-projections-transient-outside-anomaly-pipeline.md](docs/adr/0005-projections-transient-outside-anomaly-pipeline.md) — Expected impact Projections are transient, derived per-poll, outside the Anomaly→Incident pipeline
- [docs/agents/domain.md](docs/agents/domain.md) — how agents consume CONTEXT.md + ADRs
- [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) — GitHub issue conventions via `gh`
- [docs/agents/triage-labels.md](docs/agents/triage-labels.md) — triage label vocabulary
- [research/](research/) — 8-part design docs (APIs, GTFS-RT, stack, multi-operator expansion)

## Project Skills (procedural know-how)

- `.agents/skills/add-operator/SKILL.md` — add a regional operator to the map
- `.agents/skills/refresh-trip-mapping/SKILL.md` — rebuild the GTFS static trip mapping
- `.agents/skills/create-pr/SKILL.md` — open a PR (asks for base branch) with pre-PR gates (tests, build, security analysis)

## Data Attribution

Trafiklab.se (GTFS-RT, CC-BY 4.0) · OpenStreetMap · CARTO (dark tiles)
