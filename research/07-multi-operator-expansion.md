# 07 — Multi-Operator Expansion: Gothenburg & Beyond

## Problem

Current app is hardcoded to SL (Stockholm). Can we add Gothenburg (Västtrafik) and allow region switching in the UI?

## GTFS Sweden 3 — Operator Coverage

The API uses per-operator endpoints:
```
https://opendata.samtrafiken.se/gtfs-rt-sweden/{operator}/VehiclePositionsSweden.pb?key={key}
```

Same API key works for all operators. **No single combined endpoint exists.**

### Operators WITH VehiclePositions

| Operator | Slug | Region |
|----------|------|--------|
| SL | `sl` | Stockholm |
| UL | `ul` | Uppsala |
| Östgötatrafiken | `otraf` | Östergötland |
| JLT | `jlt` | Jönköping |
| Kronoberg | `krono` | Kronoberg |
| KLT | `klt` | Kalmar |
| Gotland | `gotland` | Gotland |
| Blekingetrafiken | `blekinge` | Blekinge |
| Skånetrafiken | `skane` | Skåne (Malmö/Lund) |
| Värmlandstrafik | `varm` | Värmland |
| Örebro | `orebro` | Örebro |
| Västmanland | `vastmanland` | Västmanland |
| Dalatrafik | `dt` | Dalarna |
| X-trafik | `xt` | Gävleborg |
| Din Tur | `dintur` | Västernorrland |

### Operators WITHOUT VehiclePositions

| Operator | Slug |
|----------|------|
| **Västtrafik** | `vt` |
| Hallandstrafiken | `halland` |
| Sörmlandstrafiken | `sormland` |
| Jämtland | `jamtland` |
| Västerbotten | `vasterbotten` |
| Norrbotten | `norrbotten` |

## Västtrafik (Gothenburg) — The Blocker

**Västtrafik does NOT provide VehiclePositions via Trafiklab.** This is the single biggest blocker.

### Alternative APIs

| Approach | Feasibility | Position Quality |
|----------|-------------|-----------------|
| Trafiklab GTFS-RT | Not possible — no feed | N/A |
| Planera Resa v4 `/positions` | Possible, separate auth | Low (estimated, not GPS) |
| Undocumented `/fpos` API | Works but unstable | High (actual GPS) |
| Wait for Trafiklab support | Unknown timeline | Best long-term |

**Planera Resa v4** (developer.vasttrafik.se):
- Separate registration and API key from Trafiklab
- Returns JSON, not protobuf — different data structure
- Supports bounding box filtering server-side
- Positions are **estimated**, not actual GPS — often inaccurate

## Rate Limits

| Tier | Calls/Min | Calls/Month | Cost |
|------|-----------|-------------|------|
| Bronze | 50 | 30,000 | Free |
| Silver | 250 | 2,000,000 | Free |
| Gold | 500 | 22,500,000 | Free |

Polling 2-3 operators at 2s intervals = 60-90 calls/min → **Silver tier minimum**.
Polling all 15 operators at 2s = 450 calls/min → **Gold tier required**.

**Recommendation**: Only poll operators visible in the current map viewport.

## Line Metadata

Current app uses SL-specific API (`transport.integration.sl.se/v1/lines`). No equivalent exists for other operators.

**Solution**: Use GTFS Sweden 3 static `routes.txt` — contains `route_id`, `route_short_name`, `route_long_name`, `route_type`, `agency_id` for ALL operators. This replaces the need for operator-specific line APIs.

## Architecture Changes Needed

### 1. Multi-operator polling (`trafiklab.js`)
- Parameterize operator slug (currently hardcoded `sl` on line 4)
- Poll multiple operator endpoints in parallel
- Merge vehicle arrays from all active operators

### 2. Unified line metadata
- Replace SL Lines API with GTFS static `routes.txt` parsing
- Build universal `routeId → { name, mode, operator }` lookup
- Existing `routeTypeToMode()` already handles GTFS extended route types

### 3. Viewport-based operator selection
- Map operator → geographic bounding box
- Only poll operators whose area overlaps current map viewport
- Saves API quota, reduces data volume

### 4. UI changes
- Region/operator selector in ControlPanel
- Map auto-centers on selected region
- Show active operators in stats panel

### 5. Caching
- Scope caches per operator (line "1" exists in many operators)
- Current single `linesCache` and `designationCache` need namespacing

## Recommended Strategy

**Phase 1**: Add the 15 operators that already have VehiclePositions. Start with Skåne (Malmö) as second region — large, well-supported.

**Phase 2**: Implement viewport-based polling — only fetch data for visible area.

**Phase 3**: Integrate Västtrafik via Planera Resa v4 as separate data source (accepting lower accuracy), or wait for Trafiklab support.

## Unresolved Questions

- What Silver/Gold tier approval process looks like on Trafiklab?
- Exact geographic bounding boxes for each operator's service area?
- Will Trafiklab add Västtrafik VehiclePositions? No announced timeline.
- Is the Planera Resa v4 position accuracy acceptable for a real-time map?
