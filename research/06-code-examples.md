# Code Examples & Snippets

## Complete Service Implementation

### src/services/gtfsParser.js
```javascript
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const API_BASE_URL = 'https://opendata.samtrafiken.se/gtfs-rt-sweden/sl';
const API_KEY = import.meta.env.VITE_TRAFIKLAB_SL_API_KEY;

/**
 * Fetches and parses GTFS-RT VehiclePositions feed
 * @param {string[]} lineIds - Array of line IDs to filter (e.g., ['1', '2', '3', '4'])
 * @returns {Promise<Array>} Array of bus position objects
 */
export async function getVehiclePositions(lineIds = []) {
  try {
    const url = `${API_BASE_URL}/VehiclePositionsSweden.pb?key=${API_KEY}`;

    const response = await fetch(url, {
      timeout: 5000,
      headers: {
        'Accept': 'application/x-protobuf'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    console.log(`Feed timestamp: ${new Date(feed.header.timestamp * 1000).toISOString()}`);
    console.log(`Total entities: ${feed.entity.length}`);

    // Filter and transform vehicle positions
    const buses = feed.entity
      .filter(entity => entity.vehicle && entity.vehicle.position)
      .filter(entity => {
        const routeId = entity.vehicle.trip?.routeId;
        return lineIds.length === 0 || lineIds.includes(routeId);
      })
      .map(entity => ({
        id: entity.vehicle.vehicle?.id || entity.id,
        line: entity.vehicle.trip?.routeId,
        latitude: entity.vehicle.position.latitude,
        longitude: entity.vehicle.position.longitude,
        bearing: entity.vehicle.position.bearing || 0,
        speed: entity.vehicle.position.speed || null, // m/s
        timestamp: entity.vehicle.timestamp || feed.header.timestamp,
        tripId: entity.vehicle.trip?.tripId,
        label: entity.vehicle.vehicle?.label
      }))
      .filter(bus => bus.latitude && bus.longitude); // Ensure valid coordinates

    console.log(`Filtered buses for lines ${lineIds.join(', ')}: ${buses.length}`);

    return buses;
  } catch (error) {
    console.error('Error fetching vehicle positions:', error);
    throw error;
  }
}

/**
 * Get all available routes from the feed
 */
export async function getAvailableRoutes() {
  const buses = await getVehiclePositions();
  const routes = [...new Set(buses.map(b => b.line))];
  return routes.sort();
}
```

## React Hook for Real-Time Updates

### src/hooks/useRealtimeBuses.js
```javascript
import { useState, useEffect, useRef } from 'react';
import { getVehiclePositions } from '../services/gtfsParser';

export function useRealtimeBuses(lineIds = [], interval = 2000) {
  const [buses, setBuses] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    const fetchBuses = async () => {
      try {
        const positions = await getVehiclePositions(lineIds);

        if (isActive) {
          setBuses(positions);
          setError(null);
          setLastUpdate(new Date());
          setLoading(false);
        }
      } catch (err) {
        if (isActive) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchBuses();

    // Set up polling
    intervalRef.current = setInterval(fetchBuses, interval);

    // Cleanup
    return () => {
      isActive = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [lineIds.join(','), interval]);

  const refresh = () => {
    setLoading(true);
    getVehiclePositions(lineIds)
      .then(positions => {
        setBuses(positions);
        setError(null);
        setLastUpdate(new Date());
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  return { buses, error, loading, lastUpdate, refresh };
}
```

## Map Component

### src/components/Map.jsx
```javascript
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LINE_COLORS = {
  '1': '#FF0000', // Red
  '2': '#0000FF', // Blue
  '3': '#00FF00', // Green
  '4': '#FFFF00', // Yellow
};

export function Map({ buses, center = [59.3293, 18.0686], zoom = 12 }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());

  // Initialize map
  useEffect(() => {
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://trafiklab.se">Trafiklab</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update bus markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const currentBusIds = new Set(buses.map(b => b.id));
    const existingMarkers = markersRef.current;

    // Remove markers for buses that no longer exist
    for (const [busId, marker] of existingMarkers.entries()) {
      if (!currentBusIds.has(busId)) {
        map.removeLayer(marker);
        existingMarkers.delete(busId);
      }
    }

    // Update or create markers
    buses.forEach(bus => {
      const existingMarker = existingMarkers.get(bus.id);
      const color = LINE_COLORS[bus.line] || '#888888';

      if (existingMarker) {
        // Update existing marker
        existingMarker.setLatLng([bus.latitude, bus.longitude]);
        existingMarker.setPopupContent(createPopupContent(bus));
      } else {
        // Create new marker
        const icon = L.divIcon({
          className: 'bus-marker',
          html: `
            <div style="
              background: ${color};
              border: 2px solid white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: bold;
              color: ${isLightColor(color) ? '#000' : '#fff'};
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
              ${bus.line}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([bus.latitude, bus.longitude], { icon })
          .bindPopup(createPopupContent(bus))
          .addTo(map);

        existingMarkers.set(bus.id, marker);
      }
    });

    markersRef.current = existingMarkers;
  }, [buses]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative'
      }}
    />
  );
}

function createPopupContent(bus) {
  const time = new Date(bus.timestamp * 1000).toLocaleTimeString();
  return `
    <div style="font-family: sans-serif;">
      <strong>Line ${bus.line}</strong><br/>
      ${bus.label ? `Bus: ${bus.label}<br/>` : ''}
      Speed: ${bus.speed ? (bus.speed * 3.6).toFixed(1) : 'N/A'} km/h<br/>
      Updated: ${time}
    </div>
  `;
}

function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}
```

## Main App Component

### src/App.jsx
```javascript
import { useState } from 'react';
import { Map } from './components/Map';
import { useRealtimeBuses } from './hooks/useRealtimeBuses';
import './App.css';

function App() {
  const [selectedLines, setSelectedLines] = useState(['1', '2', '3', '4']);
  const { buses, error, loading, lastUpdate, refresh } = useRealtimeBuses(selectedLines, 2000);

  const toggleLine = (line) => {
    setSelectedLines(prev =>
      prev.includes(line)
        ? prev.filter(l => l !== line)
        : [...prev, line]
    );
  };

  return (
    <div className="app">
      <div className="control-panel">
        <h2>Stockholm Real-Time Bus Map</h2>

        <div className="line-filters">
          {['1', '2', '3', '4'].map(line => (
            <label key={line}>
              <input
                type="checkbox"
                checked={selectedLines.includes(line)}
                onChange={() => toggleLine(line)}
              />
              Line {line}
            </label>
          ))}
        </div>

        <div className="status">
          {loading && <span>Loading...</span>}
          {error && <span className="error">Error: {error}</span>}
          {lastUpdate && (
            <span>
              Last update: {lastUpdate.toLocaleTimeString()}
              <button onClick={refresh}>Refresh</button>
            </span>
          )}
          <div>Buses: {buses.length}</div>
        </div>
      </div>

      <Map buses={buses} />
    </div>
  );
}

export default App;
```

## Vite Configuration

### vite.config.js
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  define: {
    'process.env': {}
  }
});
```

## Package.json Dependencies
```json
{
  "name": "sl-realtime-map",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "leaflet": "^1.9.4",
    "gtfs-realtime-bindings": "^1.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}
```

## CSS Styling

### src/App.css
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.control-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  min-width: 250px;
}

.control-panel h2 {
  margin-bottom: 15px;
  font-size: 18px;
}

.line-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.line-filters label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.status {
  font-size: 12px;
  color: #666;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.status .error {
  color: red;
}

.status button {
  margin-left: 10px;
  padding: 2px 8px;
  font-size: 11px;
}

/* Custom marker styling is inline in Map.jsx */
```
