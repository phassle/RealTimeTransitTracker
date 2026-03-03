# GTFS Realtime Format & Implementation

## What is GTFS-RT?
GTFS Realtime is a standardized format for sharing real-time public transit data. It extends the static GTFS format with live updates including:
- Vehicle positions (GPS coordinates)
- Trip updates (delays, cancellations)
- Service alerts (disruptions, route changes)

## Data Format
**Protocol Buffers (protobuf)** - Binary serialization format
- Compact and efficient
- Language-agnostic
- Requires special parsing libraries

## VehiclePositions Feed Structure

### Feed Message
```
FeedMessage {
  FeedHeader header
  repeated FeedEntity entity
}
```

### FeedEntity (Vehicle)
```
FeedEntity {
  string id
  VehiclePosition vehicle {
    VehicleDescriptor vehicle {
      string id              // Vehicle ID
      string label           // Vehicle label/number
      string license_plate   // License plate
    }
    TripDescriptor trip {
      string trip_id         // Trip identifier
      string route_id        // Route/line identifier (e.g., "1", "2", "3", "4")
      uint32 direction_id    // 0 or 1 (direction)
      string start_time
      string start_date
    }
    Position position {
      float latitude         // GPS latitude
      float longitude        // GPS longitude
      float bearing          // Direction in degrees
      float speed            // Speed in m/s
    }
    uint64 timestamp         // UNIX timestamp
    StopId current_stop_id   // Current or next stop
  }
}
```

## Filtering by Bus Lines

To track buses 1, 2, 3, 4:
1. Parse the protobuf feed
2. Iterate through all `FeedEntity` items
3. Check `trip.route_id` field
4. Filter for route_id matching "1", "2", "3", or "4"
5. Extract position data (latitude, longitude, bearing)

## Update Frequency
- SL updates vehicle positions **every 2 seconds**
- Feed timestamp indicates data freshness
- Recommended polling: every 2-3 seconds

## JavaScript Parsing Libraries

### gtfs-realtime-bindings (Recommended)
**NPM Package**: `gtfs-realtime-bindings`

```javascript
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

async function fetchVehiclePositions() {
  const response = await fetch(
    'https://opendata.samtrafiken.se/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=YOUR_API_KEY'
  );

  const buffer = await response.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer)
  );

  // Filter for bus lines 1, 2, 3, 4
  const targetLines = ['1', '2', '3', '4'];
  const buses = feed.entity
    .filter(entity => entity.vehicle)
    .filter(entity => targetLines.includes(entity.vehicle.trip?.routeId))
    .map(entity => ({
      id: entity.vehicle.vehicle.id,
      line: entity.vehicle.trip.routeId,
      lat: entity.vehicle.position.latitude,
      lon: entity.vehicle.position.longitude,
      bearing: entity.vehicle.position.bearing,
      timestamp: entity.vehicle.timestamp
    }));

  return buses;
}
```

### Alternative: protobufjs
Can compile GTFS-RT protobuf schema manually for browser environments.

## Browser Compatibility
- `gtfs-realtime-bindings` works in Node.js and browsers
- Use bundlers (Webpack, Vite) for browser deployment
- Handle CORS if needed (Trafiklab supports CORS)

## Data Size & Performance
- Full SL VehiclePositions feed: ~100-500 KB per request
- Bronze tier (50 calls/min) sufficient for 2-second updates
- Consider caching and delta updates for optimization

## Sources
- [GTFS Realtime Overview](https://developers.google.com/transit/gtfs-realtime)
- [gtfs-realtime-bindings npm](https://www.npmjs.com/package/gtfs-realtime-bindings)
- [GTFS Realtime Bindings GitHub](https://github.com/MobilityData/gtfs-realtime-bindings)
- [JavaScript/Node.js Language Bindings](https://gtfs.org/documentation/realtime/language-bindings/nodejs/)
