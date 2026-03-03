# SL-POC — Stockholm Real-Time Transit Map

Real-time map showing ~1,600 SL public transport vehicles with 2-second polling.

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
sl-poc/
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
├── research/                      # Design docs (01-06)
├── test-api.js                    # API connectivity test (hardcoded key)
├── explore-routes.js              # GTFS-RT data inspector (hardcoded key)
├── find-buses.js                  # Active bus line finder (hardcoded key)
├── index.html                     # SPA entry (loads Leaflet CSS from CDN)
├── vite.config.js                 # Vite config (port 3000)
├── package.json                   # Dependencies and scripts
└── .env                           # API keys (VITE_TRAFIKLAB_API_KEY)
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

Defined in `.env`. Keys prefixed with `VITE_` are exposed to the client via Vite.

| Variable | Used by | Purpose |
|----------|---------|---------|
| `VITE_TRAFIKLAB_API_KEY` | `trafiklab.js:3` | GTFS Sweden 3 realtime API key |
| `GTFS_REGIONAL_API_KEY` | `scripts/build-trip-mapping.js:164` | GTFS static data download |

The `.env` file also provisions `VITE_GTFS_REGIONAL_REALTIME_KEY` and `VITE_GTFS_REGIONAL_STATIC_KEY`, but these are not currently consumed by any source file.

Get keys from https://trafiklab.se/

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

This is a POC. There is no test framework, CI pipeline, or linting configuration. Validation is manual via the utility scripts and browser testing.

## Git Workflow

- Main branch: `main`
- Always create feature branches (git flow)
- Run code review before committing
- **Run a security analysis before creating a PR** — this is mandatory. Review at minimum: API key exposure, XSS vectors, unsanitized external data, dependency vulnerabilities (`npm audit`), CSP/security headers, and build configuration (source maps, secrets in bundle)

## Additional Docs

- [docs/architectural_patterns.md](docs/architectural_patterns.md) — recurring patterns across the codebase (container/presenter split, caching, marker lifecycle, etc.)
- [research/](research/) — 6-part design documentation covering APIs, GTFS-RT format, tech stack decisions, and implementation plan

## Data Attribution

- Trafiklab.se — GTFS-RT data (CC-BY 4.0)
- OpenStreetMap — map tiles
- SL Transport API — line metadata
