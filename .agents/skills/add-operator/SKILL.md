---
name: add-operator
description: Add a Swedish regional transit operator to the live map. Use when asked to add a region/operator (e.g. "add Västtrafik", "show Norrbotten buses"), expand coverage, or fix an operator whose vehicles don't appear.
---

# Add a Regional Operator

Operators are config-driven: one entry in `src/config/operators.js` makes vehicles appear when the viewport overlaps the region. No other code changes needed for basic support.

## Steps

1. **Find the feed slug.** Trafiklab's GTFS Sweden 3 realtime feeds live at `https://opendata.samtrafiken.se/gtfs-rt-sweden/<slug>/VehiclePositionsSweden.pb`. Slugs are lowercase operator codes (`sl`, `skane`, `xt`, `dintur`, …). Check the operator list at https://www.trafiklab.se/api/gtfs-datasets/gtfs-sweden/ if unsure.

2. **Verify the feed before touching code:**
   ```bash
   curl -s -o /tmp/test.pb -w "%{http_code} %{size_download}\n" \
     "https://opendata.samtrafiken.se/gtfs-rt-sweden/<slug>/VehiclePositionsSweden.pb?key=$VITE_TRAFIKLAB_API_KEY"
   ```
   Expect `200` and a non-trivial byte count. A `404` means wrong slug; `401/403` means key lacks the feed.

3. **Add the registry entry** to `src/config/operators.js:1-17`:
   ```js
   { slug: '<slug>', name: '<Display>', region: '<Region>', center: [lat, lng], bounds: [[S, W], [N, E]] }
   ```
   - `center`: the region's main city, used by the region quick-select (`src/App.jsx:91-102`).
   - `bounds`: generous bounding box of the county (län) — used for viewport-intersection polling (`src/config/operators.js:29-37`). Too tight = vehicles pop in late when panning; overlapping neighbours is fine.

4. **Check rate-limit impact.** Polling interval scales as N visible operators × 2s (`src/hooks/useRealtimeVehicles.js:14-17`); Bronze tier allows 50 calls/min. Worst case is the zoomed-out Sweden view where all bounds are visible — with N total operators that's N calls per N×2s ≈ 30 calls/min regardless of N, so adding operators is safe. Just confirm the math still holds if you change the base interval.

5. **Verify in browser:** `npm run dev`, pan/zoom to the region, confirm vehicles render and the operator shows in the popup. Mode will be `unknown` and line numbers may be raw labels — expected, see Limitations.

6. `npm test` must pass (registry shape has no dedicated test, but don't break others).

## Limitations to disclose

- **Trip mapping is SL-only.** `public/data/trip-mapping.json` is built from SL's static GTFS (`scripts/build-trip-mapping.js:19`). Other operators' vehicles fall back to `mode: 'unknown'` and `vehicle.label` for line (`src/services/trafiklab.js:84-93`). Proper modes for a new operator require extending the trip-mapping build to merge that operator's static GTFS — see `.agents/skills/refresh-trip-mapping/SKILL.md`.
- A failing operator feed degrades gracefully (`Promise.allSettled`, `src/services/trafiklab.js:121-133`) — vehicles just won't show; check console warnings.
