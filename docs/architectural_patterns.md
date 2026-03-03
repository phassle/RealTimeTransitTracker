# Architectural Patterns

Recurring patterns observed across the sl-poc codebase.

## 1. Container/Presenter Component Split

The app separates state management from rendering. `App.jsx` owns all state and passes filtered data as props to pure rendering components (`Map`, `ControlPanel`). Neither child component fetches data or manages global state.

- Container: `src/App.jsx:6-41`
- Presenters: `src/components/Map.jsx:28-134`, `src/components/ControlPanel.jsx:14-102`

## 2. Custom Hook for Data Fetching

All API interaction is isolated behind a single custom hook (`useRealtimeVehicles`) that encapsulates polling, error handling, loading state, and cleanup. Components never call services directly.

- Hook: `src/hooks/useRealtimeVehicles.js:4-64`
- Consumed at: `src/App.jsx:11`

## 3. Service Layer with Caching

External API calls live in a dedicated service module. The service caches responses that don't change frequently (SL line metadata) at module scope using a simple `let` variable, avoiding redundant network calls.

- Cache declaration: `src/services/trafiklab.js:7`
- Cache check: `src/services/trafiklab.js:13`
- Cache population: `src/services/trafiklab.js:36`

## 4. Parallel Data Fetching

When multiple independent API calls are needed, `Promise.all` is used to fetch them concurrently rather than sequentially.

- `src/services/trafiklab.js:49-54` — fetches line metadata and vehicle positions in parallel

## 5. Color Constant Maps

Transport mode colors are defined as plain objects (not enums or classes) and duplicated across components that need them. Both `Map.jsx` and `ControlPanel.jsx` maintain their own color definitions.

- Map colors: `src/components/Map.jsx:5-13`
- Panel colors: `src/components/ControlPanel.jsx:4-12`

This is a known duplication. A shared constants file would deduplicate but was not introduced to keep the POC simple.

## 6. Marker Lifecycle Management

The map component manages Leaflet markers imperatively using refs, tracking them in a `Map<vehicleId, marker>`. On each update cycle it: (1) removes stale markers, (2) updates positions of existing markers, (3) creates new markers. This avoids recreating all markers every 2 seconds.

- Stale removal: `src/components/Map.jsx:67-72`
- Update existing: `src/components/Map.jsx:80-83`
- Create new: `src/components/Map.jsx:86-119`

## 7. Ref-Based Unmount Guard

The polling hook uses a ref (`isActiveRef`) to prevent state updates after component unmount — a standard React pattern for async operations that may complete after teardown.

- Guard declaration: `src/hooks/useRealtimeVehicles.js:10`
- Guard check: `src/hooks/useRealtimeVehicles.js:18`, `src/hooks/useRealtimeVehicles.js:25`
- Cleanup: `src/hooks/useRealtimeVehicles.js:41-46`

## 8. Protocol Buffer Binary Parsing

GTFS-RT data arrives as Protocol Buffer binary. The service fetches raw bytes, converts to `Uint8Array`, and uses `gtfs-realtime-bindings` to decode. This pattern is reused across utility scripts (`test-api.js`, `explore-routes.js`, `find-buses.js`).

- Core parsing: `src/services/trafiklab.js:60-64`

## 9. Utility Scripts as Standalone Node Programs

Root-level `.js` files (`test-api.js`, `explore-routes.js`, `find-buses.js`) serve as ad-hoc data exploration tools. They use ESM imports, run with `node <script>`, and have no shared framework — each is self-contained.

## 10. Memoized Derived State

Filtering (vehicles by transport mode) uses `useMemo` to avoid recalculating on every render. The dependency array is explicit: `[allVehicles, enabledModes]`.

- `src/App.jsx:14-17`
