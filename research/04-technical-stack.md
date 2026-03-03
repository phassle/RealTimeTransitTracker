# Technical Stack & Implementation

## Frontend Framework Options

### 1. Vanilla JavaScript + HTML5
**Pros**: Simple, no build step, fast prototyping
**Cons**: Limited scalability, manual state management

### 2. React + Vite
**Pros**: Component-based, fast dev server, modern tooling
**Cons**: Overhead for simple project

### 3. Vue.js
**Pros**: Easy learning curve, reactive data binding
**Cons**: Less ecosystem than React

**Recommendation**: **React + Vite** for modern development experience

## Map Visualization Libraries

### 1. Leaflet.js (Recommended)
**Why**:
- Free and open-source
- Lightweight (~40KB)
- Excellent documentation
- Large plugin ecosystem
- Easy marker manipulation

**Basic Setup**:
```javascript
import L from 'leaflet';

const map = L.map('map').setView([59.3293, 18.0686], 12); // Stockholm center

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);
```

**Bus Markers**:
```javascript
const busIcon = L.divIcon({
  className: 'bus-marker',
  html: `<div style="background: red; border-radius: 50%; width: 20px; height: 20px;"></div>`,
  iconSize: [20, 20]
});

const marker = L.marker([lat, lon], { icon: busIcon })
  .bindPopup('Bus Line 1')
  .addTo(map);
```

### 2. Mapbox GL JS
**Why**:
- Beautiful vector tiles
- Smooth animations
- WebGL-powered

**Cons**:
- Requires Mapbox API key
- Free tier: 50,000 loads/month

### 3. Google Maps API
**Cons**:
- Expensive
- Requires billing account

**Recommendation**: **Leaflet.js** for this project (free, simple, powerful)

## Additional Libraries

### GTFS Parsing
- **gtfs-realtime-bindings** - Parse protobuf feeds

### HTTP Client
- **fetch API** (built-in) - Sufficient for this project
- **axios** - If more features needed

### State Management
- **React useState/useEffect** - Sufficient for this project
- **Zustand** - If complex state needed

### Styling
- **Tailwind CSS** - Utility-first CSS
- **CSS Modules** - Scoped styles

## Project Structure (React + Vite)

```
sl-poc/
├── .env                          # API keys
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx                  # Entry point
│   ├── App.jsx                   # Main component
│   ├── components/
│   │   ├── Map.jsx               # Leaflet map component
│   │   ├── BusMarker.jsx         # Individual bus marker
│   │   └── Legend.jsx            # Line legend
│   ├── services/
│   │   ├── trafiklab.js          # API calls
│   │   └── gtfsParser.js         # GTFS-RT parsing
│   ├── hooks/
│   │   └── useRealtimeBuses.js   # Custom hook for polling
│   └── styles/
│       └── map.css               # Map-specific styles
└── research/                      # Documentation (this folder)
```

## Real-Time Updates Implementation

### Option 1: Polling (Recommended)
```javascript
useEffect(() => {
  const fetchBuses = async () => {
    const buses = await getVehiclePositions(['1', '2', '3', '4']);
    setBuses(buses);
  };

  fetchBuses(); // Initial fetch
  const interval = setInterval(fetchBuses, 2000); // Poll every 2 seconds

  return () => clearInterval(interval);
}, []);
```

### Option 2: WebSocket
- Trafiklab doesn't provide WebSocket endpoints for GTFS-RT
- Would require custom backend server
- Polling is simpler and sufficient

## Performance Considerations

### Marker Updates
Instead of removing and re-adding markers:
```javascript
// Update existing marker position
marker.setLatLng([newLat, newLon]);
marker.setRotationAngle(bearing); // Requires Leaflet.RotatedMarker plugin
```

### Filtering
Filter data on client-side after fetching full feed:
- Bronze tier allows 50 calls/min (sufficient)
- Client-side filtering is fast enough
- Could cache and compare timestamps

### Map Rendering
- Limit zoom levels
- Use marker clustering if many buses
- Debounce/throttle map events

## Browser Requirements
- Modern browser with ES6+ support
- WebGL support (for Mapbox if used)
- LocalStorage for caching (optional)

## Development Tools
- **Vite** - Fast dev server with HMR
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Sources
- [Leaflet Documentation](https://leafletjs.com/)
- [GTFS Visualizations](https://old.gtfs.org/resources/visualizations/)
- [Visualizing Realtime Bus Locations using GTFS-RT](https://www.walterkjenkins.com/blog/Visualizing%20Realtime%20Bus%20Locations)
- [awesome-transit GitHub](https://github.com/MobilityData/awesome-transit)
