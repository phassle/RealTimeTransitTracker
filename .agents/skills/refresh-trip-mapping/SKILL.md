---
name: refresh-trip-mapping
description: Rebuild public/data/trip-mapping.json from GTFS static data. Use when vehicles show wrong/unknown modes or stale line numbers, after SL timetable changes, or when extending mode mapping to a new operator.
---

# Refresh the Trip Mapping

`public/data/trip-mapping.json` maps GTFS-RT `tripId` → `{ line, routeType }`. It's the only way the app knows a vehicle's transport mode and human line number — the realtime feed alone carries neither reliably. It's a build artifact, committed to the repo, loaded once at runtime (`src/services/trafiklab.js:38-54`).

## When it goes stale

SL publishes new static GTFS with each timetable change; trip IDs rotate. Symptoms: growing share of `unknown`-mode vehicles, line numbers showing raw vehicle labels. There is no automated refresh — it's manual.

## Steps

1. Ensure `GTFS_REGIONAL_API_KEY` is in `.env` (falls back to `VITE_TRAFIKLAB_API_KEY`, `scripts/build-trip-mapping.js:164`). This is the **GTFS Regional/Static** key, distinct from the realtime key.
2. Run:
   ```bash
   node scripts/build-trip-mapping.js
   ```
   Downloads `https://opendata.samtrafiken.se/gtfs/sl/sl.zip` (~tens of MB), joins `trips.txt` × `routes.txt`, writes the JSON, cleans up `./tmp`.
3. Sanity-check output size (printed in KB) — order of magnitude should match the committed file. A tiny file means a truncated download or schema change in the GTFS zip.
4. Smoke test: `npm run dev`, confirm metro/train/tram modes and line numbers look right in Stockholm.
5. Commit the regenerated `public/data/trip-mapping.json`.

## Failure modes

- `401/403` on download → wrong key type; you need a GTFS Sweden **static** key from https://developer.trafiklab.se/, not the realtime one.
- Script exits non-zero → it cleans `./tmp` itself; just rerun. Don't commit a partial JSON.
- All modes still `unknown` after rebuild → trip IDs in the realtime feed may not match static GTFS (operator mismatch); inspect with `node explore-routes.js`.

## Extending to a new operator

The script is hardcoded to SL (`GTFS_REGIONAL_URL`, `scripts/build-trip-mapping.js:19`). To give another operator real modes: download that operator's static zip (`https://opendata.samtrafiken.se/gtfs/<slug>/<slug>.zip`), build its mapping the same way, and **merge** into the single JSON — keys are trip IDs and globally unique per feed, so a flat merge is safe. Keep an eye on file size; the JSON ships to every client.
