# 08 — Mälartrafik (Mälardalstrafik / MÄLAB)

## TL;DR

**No GTFS-RT VehiclePositions available.** Cannot be integrated for real-time tracking with current public APIs.

## What is Mälartrafik?

Regional train operator (brand: **Mälartåg**) running 5 lines across 6 regions, 44 stations, 1,060 km of track. Jointly owned by the regional PTAs (Stockholm, Uppsala, Sörmland, Västmanland, Örebro, Östergötland).

### Lines

| Line | Corridor |
|------|----------|
| 1 | Örebro — Eskilstuna — Stockholm |
| 2 | Norrköping — Nyköping — Stockholm |
| 3 | Sala — Västerås — Eskilstuna — Katrineholm — Norrköping |
| 4 | Stockholm — Uppsala |
| 5 | Uppsala — Gävle |

### Geographic Coverage

Stockholm, Uppsala, Södermanland, Västmanland, Örebro, Östergötland. ~200 km radius around Stockholm.

## Trafiklab API Status

| Data Type | Available? |
|-----------|-----------|
| GTFS-RT VehiclePositions | No |
| GTFS-RT TripUpdates | No |
| GTFS-RT ServiceAlerts | No |
| GTFS static (schedules) | Yes — in GTFS Sverige 2 (national) |

Operator slug `malartag` exists in GTFS Sweden 3 but only for **replacement bus data** (static only).

## Alternative Data Sources

- **Trafikverket Open API**: Station arrival/departure data for all trains including Mälartåg. No GPS positions — timetable-level only.
- **Mälartrafik direct API**: None found. No developer portal.

## Relationship to SL/UL

Mälartåg is the **inter-regional** rail layer. SL and UL handle local transport within their counties. Mälartåg trains pass through SL/UL territory but are **NOT included** in SL or UL VehiclePositions feeds.

Ticket integration via **Movingo** (cross-county period ticket).

Operations contracted to Transdev (VR taking over with 8-year contract).

## Conclusion

Mälartåg is a significant gap in Sweden's open transit data. One of the largest regional train operators but no real-time position data available through any public API.

### Unresolved Questions

- Will Trafiklab add Mälartåg VehiclePositions?
- Could Trafikverket station data be used to interpolate approximate train positions between stations?
- Does the new operator (VR) have plans for open data?
