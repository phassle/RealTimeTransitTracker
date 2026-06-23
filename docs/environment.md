# Environment & config

`.env` (see `.env.example`). `VITE_`-prefixed keys are **bundled into the client** by design.

| Variable | Used by | Purpose |
|----------|---------|---------|
| `VITE_TRAFIKLAB_API_KEY` | `src/services/trafiklab.js:3` | GTFS-RT realtime feeds (client-side; intentionally public) |
| `GTFS_REGIONAL_API_KEY` | `scripts/build-trip-mapping.js:164` | GTFS static download (build-time only; must NOT bundle) |

Keys from https://developer.trafiklab.se/. Rate limit: Bronze, 50 calls/min — polling auto-scales to N operators × 2s (`src/hooks/useRealtimeVehicles.js:14-17`) to stay under it.

## Debug / exploration scripts

Not part of the build — ad-hoc data-plumbing checks (no e2e suite):

```bash
node test-api.js                     # API connectivity check
node explore-routes.js               # inspect raw GTFS-RT entities
node find-buses.js                   # list active bus lines
node scripts/build-trip-mapping.js   # rebuild public/data/trip-mapping.json (or use the refresh-trip-mapping skill)
```
