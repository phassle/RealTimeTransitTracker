# Architectural Patterns

Recurring patterns across the RealTimeTransitTracker codebase. Follow these when extending the app; deviations deserve an ADR.

## 1. Container/Presenter Component Split

`App.jsx` owns all state and passes filtered data as props to pure rendering components. Children never fetch data or own global state.

- Container: `src/App.jsx:9-135`
- Presenters: `src/components/Map.jsx:37-191`, `src/components/ControlPanel.jsx:17`, `src/components/PrivacyNotice.jsx`

## 2. Custom Hook per Concern

Each stateful concern is isolated behind a hook: polling (`useRealtimeVehicles`), theming (`useTheme`), privacy-notice dismissal (`useConsent`). Components never call services or `localStorage` directly.

- `src/hooks/useRealtimeVehicles.js:4-89`, consumed at `src/App.jsx:24-25`
- `src/hooks/useTheme.js:31-63`, `src/hooks/useConsent.js:21-30`

## 3. Module-Scope Tri-State Cache

Static data that rarely changes is cached in a module-level variable with three states: `undefined` = not loaded yet, `null` = fetch attempted and unavailable (don't retry), object = loaded. Prevents both redundant fetches and retry storms.

- Declaration: `src/services/trafiklab.js:6`
- Load + state transitions: `src/services/trafiklab.js:38-54`

## 4. Partial-Failure-Tolerant Fan-Out

Multi-operator fetches use `Promise.allSettled`, not `Promise.all`: one operator's feed failing must not blank the whole map. Failures are logged per-operator and skipped.

- `src/services/trafiklab.js:121-133`

## 5. Color Constant Maps (Known Duplication)

Transport-mode colors are plain objects duplicated in both components that need them. Kept duplicated deliberately for POC simplicity — **change both when adding a mode**.

- `src/components/Map.jsx:6-14`
- `src/components/ControlPanel.jsx:4-12`

## 6. Marker Lifecycle Management

`Map.jsx` manages Leaflet markers imperatively via a ref-held `Map<vehicleId, marker>`. Each cycle: remove stale, update existing positions, create new. Avoids recreating ~1,600 markers every poll.

- Stale removal: `src/components/Map.jsx:123-128`
- Update existing: `src/components/Map.jsx:136-139`
- Create new: `src/components/Map.jsx:141-175`

## 7. Ref-Based Unmount Guard

The polling hook guards async completions with `isActiveRef` so state is never set after teardown.

- Declaration: `src/hooks/useRealtimeVehicles.js:10`
- Checks: `src/hooks/useRealtimeVehicles.js:25`, `:32`
- Cleanup: `src/hooks/useRealtimeVehicles.js:67-71`

## 8. Protocol Buffer Binary Parsing

GTFS-RT arrives as protobuf: fetch bytes → `Uint8Array` → `FeedMessage.decode`. Same shape reused in the root utility scripts (`test-api.js`, `explore-routes.js`, `find-buses.js`).

- Core parsing: `src/services/trafiklab.js:72-74`

## 9. Utility Scripts as Standalone Node Programs

Root-level `.js` files are self-contained ESM scripts run with `node <script>` — no shared framework. They substitute for an e2e suite when validating data plumbing.

## 10. Memoized Derived State

All derived collections (available lines grouped by mode, filtered vehicles, visible operators) use `useMemo` with explicit dependency arrays.

- `src/App.jsx:19-22`, `src/App.jsx:28-50`, `src/App.jsx:53-61`

## 11. Graceful localStorage Degradation

Every `localStorage` read/write is wrapped in `try/catch` and degrades silently (private mode, quota): the feature works for the session, the preference just doesn't persist. Never let storage failure throw into render.

- `src/hooks/useTheme.js:5-29`
- `src/hooks/useConsent.js:5-19`

## 12. Viewport-Driven Operator Selection

Only operators whose bounding box intersects the visible map are polled. The map reports debounced (300ms) bounds upward; `App.jsx` derives the operator list; the hook re-polls when it changes.

- Bounds reporting: `src/components/Map.jsx:67-83`
- Intersection test: `src/config/operators.js:29-37`
- Derivation: `src/App.jsx:19-22`

## 13. Adaptive Polling Interval + Visibility Pause

Polling interval scales with operator count (N operators → N × 2s) to stay under the Trafiklab 50 calls/min cap, and pauses entirely while the tab is hidden, resuming with an immediate fetch.

- Interval scaling: `src/hooks/useRealtimeVehicles.js:14-17`
- Visibility handling: `src/hooks/useRealtimeVehicles.js:52-59`

## 14. Theme as Data Attribute + Tile Provider Swap

Theme = explicit localStorage choice ?? live OS preference. Applied two ways: `data-theme` on `<html>` for CSS, and a Leaflet tile-layer swap (light OSM / dark CARTO — ADR 0002). The OS listener detaches once the user toggles explicitly.

- Resolution + attribute: `src/hooks/useTheme.js:31-54`
- Tile swap effect: `src/components/Map.jsx:96-101`
- Provider config: `src/components/tileLayerConfig.js:1-13`

## 15. Escape External Data Before HTML Injection

Feed-derived strings (line, mode, operator) pass through `escapeHtml` before being interpolated into Leaflet `divIcon`/popup HTML. Any new popup/tooltip content from the feed must do the same.

- Helper: `src/components/Map.jsx:26-32`
- Usage: `src/components/Map.jsx:160`, `:169`, `:199-200`
