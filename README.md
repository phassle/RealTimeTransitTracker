# Real-Time Transit Tracker — Sweden

Client-only React app for viewing real-time public-transport vehicles across Sweden on a Leaflet map. The app polls Trafiklab GTFS-RT feeds, fetches only operators whose regions overlap the current viewport, and also includes a Command Center view for incident-style monitoring.

## Features

- Sweden-wide vehicle map with **15 regional operators**
- **Viewport-driven polling** of only visible operators
- **2s base polling**, auto-scaled by operator count to stay under rate limits
- Filters by **transport mode** and **line**
- **Favourite lines** persisted between visits
- **Region shortcuts** for jumping around Sweden
- Optional **webcam layer** with type filters
- **Command Center** view with incidents, replay, and feed-status monitoring
- **Dark/light theme**, **offline banner**, **update prompt**, and **user location**
- PWA build via Vite PWA

## Current transport modes

- Metro
- Bus
- Train
- Tram
- Ferry
- Other

## Tech stack

- **UI**: React 19, JSX
- **Build**: Vite 7, ES modules
- **Map**: Leaflet 1.9
- **Data**: Trafiklab GTFS-RT protobuf feeds
- **Parsing**: `gtfs-realtime-bindings`
- **Tests**: Vitest + Testing Library
- **Runtime**: Node.js **>= 20.19**

## Getting started

### 1. Install

- Node.js ≥ 20.19 (≥ 22.13 to run the Aspire AppHost — the default below)
- The [Aspire CLI](https://aspire.dev) and the .NET SDK (provides the `aspire` command)
- Trafiklab API keys (see below)

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the keys you need from:

- https://developer.trafiklab.se/
- https://data.trafikverket.se
- https://api.windy.com/webcams

### 3. Run locally

```bash
npm run dev
```

4. Start the site (via Aspire — the default):
   ```bash
   npm run aspire:start
   ```
   This launches the app through the Aspire AppHost and opens the Aspire
   dashboard (it also streams the browser console/network). Open the app from
   the URL shown on the dashboard.

   Or run the Vite dev server directly, without Aspire:
   ```bash
   npm run dev
   ```
   then open http://localhost:3000/ in your browser.

```bash
npm run dev         # Vite dev server
npm test            # Vitest single run
npm run build       # Production build to dist/
npm run typecheck   # Alias for vite build
npm run preview     # Preview production build
npm run aspire:start
npm run aspire:build
npm run aspire:dev
```

- `npm run aspire:start` - **Default.** Start the site via the Aspire AppHost (dashboard + browser-log capture)
- `npm run dev` - Start the Vite dev server only (http://localhost:3000/)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run the test suite

```bash
node test-api.js
node explore-routes.js
node find-buses.js
node scripts/build-trip-mapping.js
```

## Environment variables

See `.env.example`.

| Variable | Purpose |
|---|---|
| `VITE_TRAFIKLAB_API_KEY` | Client-side GTFS-RT realtime feeds |
| `VITE_GTFS_REGIONAL_REALTIME_KEY` | Regional realtime key |
| `VITE_GTFS_REGIONAL_STATIC_KEY` | Regional static key |
| `GTFS_REGIONAL_API_KEY` | Build-time key for `scripts/build-trip-mapping.js` |
| `VITE_TRAFIKVERKET_API_KEY` | Trafikverket webcam source |
| `VITE_WINDY_API_KEY` | Windy webcam source |

`VITE_` variables are bundled into the client by design.

## Data flow

```text
Trafiklab per-operator GTFS-RT feeds + static trip mapping
  -> src/services/trafiklab.js
  -> src/hooks/useRealtimeVehicles.js
  -> src/App.jsx
  -> map / control panel / command center
```

## Data sources

- **Trafiklab GTFS Sweden 3** — vehicle positions
- **GTFS static data** — trip/route enrichment
- **Trafikverket** — webcam data
- **Windy** — webcam metadata
- **OpenStreetMap / CARTO** — map tiles

## Notes

- No backend; everything runs in the browser
- Privacy model is cookieless except for essential storage such as theme / favourites / notice acknowledgement
- Production build ships without sourcemaps

## Attribution

- Data: [Trafiklab.se](https://trafiklab.se)
- Traffic cameras: [Trafikverket](https://www.trafikverket.se/)
- Map: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Dark tiles: [CARTO](https://carto.com/)
