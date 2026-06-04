# RealTimeTransitTracker — Sweden Real-Time Transit Map

Real-time map showing ~1,600 public transport vehicles with 2-second polling. Currently Stockholm (SL), expanding to all of Sweden.

## Response Style

- Be extremely concise. Sacrifice grammar for concision.
- At the end of each plan, list unresolved questions (if any).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, JSX |
| Build | Vite 7, ES modules (`"type": "module"`) |
| Map | Leaflet 1.9 + OpenStreetMap tiles |
| Data | GTFS-RT (Protocol Buffers) via Trafiklab API |
| Parsing | gtfs-realtime-bindings |
| Runtime | Node.js 18+ |

## Project Structure

```
RealTimeTransitTracker/
├── src/
│   ├── App.jsx                    # Root component, state owner
│   ├── main.jsx                   # React DOM mount
│   ├── components/
│   │   ├── Map.jsx                # Leaflet map + vehicle markers
│   │   └── ControlPanel.jsx       # Mode filters, stats, controls
│   ├── hooks/
│   │   └── useRealtimeVehicles.js # Polling hook (2s interval)
│   └── services/
│       └── trafiklab.js           # API client, protobuf parsing, line cache
├── scripts/
│   └── build-trip-mapping.js      # GTFS static data → trip-mapping.json
├── research/                      # Design docs (01-07)
├── test-api.js                    # API connectivity test
├── explore-routes.js              # GTFS-RT data inspector
├── find-buses.js                  # Active bus line finder
├── index.html                     # SPA entry (loads Leaflet CSS from CDN)
├── vite.config.js                 # Vite config (port 3000)
├── package.json                   # Dependencies and scripts
├── .env                           # API keys (VITE_TRAFIKLAB_API_KEY)
└── .env.example                   # Template for API keys (safe to commit)
```

## Data Flow

```
Trafiklab GTFS-RT API (protobuf) + SL Lines API (JSON)
  → trafiklab.js (parse, enrich, cache)
    → useRealtimeVehicles (poll, state management)
      → App.jsx (filter by mode)
        → Map.jsx (render markers) + ControlPanel.jsx (UI controls)
```

## Commands

```bash
npm install                          # Install dependencies
npm run dev                          # Dev server at http://localhost:3000
npm run build                        # Production build to dist/
npm run preview                      # Preview production build
node test-api.js                     # Test API connectivity
node explore-routes.js               # Inspect GTFS-RT data structure
node find-buses.js                   # List active bus lines
node scripts/build-trip-mapping.js   # Build GTFS static trip mapping
```

## Environment Variables

Defined in `.env`. Keys prefixed with `VITE_` are exposed to the client via Vite. See `.env.example` for all required keys.

| Variable | Used by | Purpose |
|----------|---------|---------|
| `VITE_TRAFIKLAB_API_KEY` | `trafiklab.js:3` | GTFS Sweden 3 realtime API key |
| `GTFS_REGIONAL_API_KEY` | `scripts/build-trip-mapping.js:164` | GTFS static data download |

Get keys from https://developer.trafiklab.se/

## Key Implementation Details

**Transport modes**: metro, bus, train, tram, ship, ferry, unknown — each with a consistent color defined in `src/components/Map.jsx:5-13` and `src/components/ControlPanel.jsx:4-12`.

**Vehicle object shape** (returned by `trafiklab.js:69-90`):
`{ id, routeId, line, lineName, mode, latitude, longitude, bearing, speed, timestamp, tripId, direction }`

**API endpoints**:
- Vehicle positions: `opendata.samtrafiken.se/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb` — `trafiklab.js:4`
- Line metadata: `transport.integration.sl.se/v1/lines` — `trafiklab.js:16`

**Rate limits**: Bronze tier — 50 calls/min, 30k calls/month. Current usage: 30 calls/min (2s interval).

**Performance**: `preferCanvas: true` on Leaflet (`Map.jsx:38`), marker reuse instead of recreation (`Map.jsx:67-119`), `useMemo` for filtered vehicles (`App.jsx:14-17`).

## No Build System / Test Suite

POC — no test framework, CI, or linting. Validation via utility scripts and browser testing.

## Git Workflow

- Main branch: `main`
- Always create feature branches (git flow)
- Run code review before committing
- **Run a security analysis before creating a PR** — mandatory. Check: API key exposure, XSS vectors, unsanitized external data, dependency vulnerabilities (`npm audit`), CSP/security headers, build config (source maps, secrets in bundle)

## Additional Docs

- [docs/architectural_patterns.md](docs/architectural_patterns.md) — recurring patterns (container/presenter split, caching, marker lifecycle)
- [research/](research/) — 7-part design documentation covering APIs, GTFS-RT format, tech stack, implementation plan, and multi-operator expansion

## Agent skills

### Issue tracker

GitHub issues at `phassle/RealTimeTransitTracker` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

## Data Attribution

- Trafiklab.se — GTFS-RT data (CC-BY 4.0)
- OpenStreetMap — map tiles
- SL Transport API — line metadata
