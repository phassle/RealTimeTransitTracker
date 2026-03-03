# Project Overview: Real-Time Stockholm Bus Map

## Goal
Build a real-time map of Stockholm showing the positions of buses on lines 1, 2, 3, and 4 with approximately 2-second update delay.

## Key Requirements
- Real-time tracking of specific bus lines (1, 2, 3, 4)
- 2-second refresh rate
- Visual map display of Stockholm
- Live vehicle position updates

## Data Source
**Trafiklab** (https://trafiklab.se/) - Sweden's public transport data platform providing free access to transit data APIs.

## Primary API Solution
**GTFS Sweden 3 - VehiclePositions Feed**
- Provides real-time GPS coordinates of all SL vehicles
- Updates every 2 seconds
- GTFS-Realtime protocol buffer format
- Free access with API key registration

## Alternative APIs
1. **Trafiklab Realtime APIs** - Departure boards and timetables
2. **SL Transport API** - Lines, stops, and departures (no vehicle positions)

## Next Steps
1. Register for Trafiklab API key
2. Set up GTFS-RT protobuf parsing
3. Implement map visualization (Leaflet/MapBox)
4. Filter vehicle positions by bus lines 1-4
5. Implement 2-second polling/streaming
