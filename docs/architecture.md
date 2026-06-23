# Architecture

State lives **only** in `App.jsx`; components are presenters; all I/O is behind the hook + service. Read this before deviating. Deeper recurring patterns with anchors: [architectural_patterns.md](architectural_patterns.md).

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, JSX |
| Build | Vite 7, ES modules (`"type": "module"`) |
| Map | Leaflet 1.9 — OSM tiles (light) / CartoDB Dark Matter (dark, ADR 0002) |
| Data | GTFS-RT protobuf via Trafiklab, decoded with gtfs-realtime-bindings |
| Tests | Vitest + Testing Library, jsdom (`vite.config.js:12-17`) |
| Runtime | Node.js ≥20.19 (≥22.13 with the Aspire AppHost) |

## Data flow

```
Trafiklab GTFS-RT per-operator feeds (protobuf) + /data/trip-mapping.json (static, prebuilt)
  → src/services/trafiklab.js        parse, map route_type → mode, enrich line names
    → src/hooks/useRealtimeVehicles.js  poll, adaptive interval, tab-visibility pause
      → src/App.jsx                  owns all state; filters by mode/line/viewport
        → src/components/Map.jsx     marker lifecycle (reuse, not recreate)
        → src/components/ControlPanel.jsx  filters, stats, theme toggle
```

## Command Center

Additive second view, toggled in `App.jsx:86-104`; the map view is untouched (PRD #84, ADR 0003). Derives an operational picture from the polling the app already does — zero new feed calls, all in-memory (ADR 0001):

```
vehicles + per-operator fetch outcomes (each poll)
  → services/observationBuffer.js   rolling ~30 min window; Recording export/import (versioned envelope)
    → services/anomalyRules.js       stationary-on-active-trip + learnDwellSpots (suppress habitual stops)
      → services/feedOutageRules.js  fetch-fail / frozen-timestamps / vehicle-count-collapse → operator-subject Anomalies
        → services/incidentClustering.js  Anomalies → Incidents (time+space / operator); lifecycle, stale-freeze, cross-rule merge, demo marker
          → hooks/useIncidents.js    owns the pipeline + replay/inject/recording/verify; injectedIncident.js seeds demo via same seam
            → components/CommandCenter.jsx  inbox + map + detail (Why-flagged evidence, timeline, nearby webcams), Replay, FeedStatus
```

Anomaly carries structured **evidence** only (rule, threshold, measured value, refs, timestamps) — presenters render text, rules never do. **Injected Incidents** enter through the same `clusterIncidents` seam, demo-labelled on every surface. **nearbyWebcams.js** ranks the curated webcam list by distance (traffic cameras first); webcam embed boundary is ADR 0004. Glossary: CONTEXT.md § Operational picture.

The highest-value test seam is `incidentClustering.test.js`. Incident **subject** is discriminated: geographic area vs operator (feed outage = operator, no ground geometry). All command-center state is in-memory; Recordings are files on disk, never client storage (ADR 0001/0003).

## Key implementation facts

- **Vehicle shape** (`src/services/trafiklab.js:95-109`): `{ id, operator, routeId, line, lineName, mode, latitude, longitude, bearing, speed, timestamp, tripId, direction }`
- **Modes**: metro, bus, train, tram, ship, ferry, unknown. GTFS `route_type` → mode map: `src/services/trafiklab.js:8-28`. Colors duplicated in `src/components/Map.jsx:6-14` and `src/components/ControlPanel.jsx:4-12` — change both.
- **Operator registry** (slug, center, bounding box): `src/config/operators.js:1-17`; viewport → operators: `src/config/operators.js:29-37`
- **Feed URL**: `opendata.samtrafiken.se/gtfs-rt-sweden/<slug>/VehiclePositionsSweden.pb` (`src/services/trafiklab.js:56-58`); per-operator failures tolerated via `Promise.allSettled` (`trafiklab.js:121-133`)
- **Theme**: OS preference + localStorage override (`src/hooks/useTheme.js`), tile provider swap (`src/components/tileLayerConfig.js`, ADR 0002)
- **Performance**: `preferCanvas` (`Map.jsx:55-57`), marker reuse (`Map.jsx:115-179`), memoized filtering (`App.jsx:28-61`)
- **Security**: external feed data is HTML-escaped before popup injection (`Map.jsx:26-32`) — keep it that way
