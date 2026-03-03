# Trafiklab APIs Documentation

## Available APIs Overview

### 1. GTFS Sweden 3 (Recommended for Vehicle Positions)
**Purpose**: Real-time vehicle tracking across Sweden
**Format**: GTFS-Realtime (Protocol Buffers)
**Update Frequency**: Every 2 seconds
**Authentication**: API key required

#### VehiclePositions Endpoint
```
https://opendata.samtrafiken.se/gtfs-rt-sweden/{operator}/VehiclePositionsSweden.pb?key={apikey}
```

**Operator for Stockholm**: `sl`

**Example URL**:
```
https://opendata.samtrafiken.se/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=YOUR_API_KEY
```

#### Rate Limits by Tier
| Tier | Calls/Minute | Calls/Month | Cost |
|------|--------------|-------------|------|
| Bronze | 50 | 30,000 | Free |
| Silver | 250 | 2,000,000 | Free |
| Gold | 500 | 22,500,000 | Free |

**For 2-second updates**: 30 calls/minute = one call every 2 seconds ✓ (Bronze tier sufficient)

### 2. Trafiklab Realtime APIs
**Purpose**: Departure boards, arrival times, stop lookup
**Format**: JSON
**Use Case**: Not ideal for vehicle positions

#### Available Endpoints
1. **Timetables** - Departures/arrivals from stops
2. **Stop Lookup** - Find stop IDs
3. **Trips (beta)** - Trip details

#### Rate Limits
| Level | Calls/Minute | Calls/Month |
|-------|--------------|-------------|
| Bronze | 25 | 100,000 |
| Silver | 150 | 5,000,000 |
| Gold | 1,200 | 50,000,000 |

### 3. SL Transport API
**Purpose**: Lines, stops, departures
**Format**: JSON
**Authentication**: None required
**Limitation**: **Does NOT provide vehicle positions**

#### Endpoints
```
https://transport.integration.sl.se/v1/lines?transport_authority_id=1
https://transport.integration.sl.se/v1/sites/{siteId}/departures
https://transport.integration.sl.se/v1/stop-points
```

## Recommendation
**Use GTFS Sweden 3 VehiclePositions feed** for this project as it:
- Provides actual GPS coordinates
- Updates every 2 seconds (matches requirement)
- Includes all SL buses
- Free Bronze tier supports the use case

## License
All Trafiklab data is available under **CC-BY 4.0** license, requiring attribution to Trafiklab.se.

## Sources
- [Trafiklab](https://www.trafiklab.se/)
- [Trafiklab Realtime APIs](https://www.trafiklab.se/api/our-apis/trafiklab-realtime-apis/)
- [SL's APIs](https://www.trafiklab.se/api/our-apis/sl/)
- [GTFS Sweden 3](https://www.trafiklab.se/api/gtfs-datasets/gtfs-sweden/)
