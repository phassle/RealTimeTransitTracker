# Implementation Plan

## Phase 1: Setup & Authentication (1-2 hours)

### 1.1 Project Initialization
- [x] Create project directory structure
- [ ] Initialize Vite + React project
  ```bash
  npm create vite@latest . -- --template react
  npm install
  ```
- [ ] Install dependencies:
  ```bash
  npm install leaflet gtfs-realtime-bindings
  npm install -D @types/leaflet
  ```

### 1.2 API Key Registration
- [ ] Sign up at https://trafiklab.se/
- [ ] Create API project
- [ ] Subscribe to "GTFS Sweden 3" API (Bronze tier)
- [ ] Copy API key to `.env` file
- [ ] Test API access with curl:
  ```bash
  curl "https://opendata.samtrafiken.se/gtfs-rt-sweden/sl/VehiclePositionsSweden.pb?key=YOUR_KEY" -o test.pb
  ```

### 1.3 Environment Configuration
- [x] Create `.env` file with API key
- [ ] Configure Vite to load environment variables
- [ ] Add `.env` to `.gitignore`

## Phase 2: Data Layer (2-3 hours)

### 2.1 GTFS-RT Parser Service
Create `src/services/gtfsParser.js`:
- [ ] Import gtfs-realtime-bindings
- [ ] Implement fetch + decode function
- [ ] Filter by route IDs (1, 2, 3, 4)
- [ ] Transform to simplified data structure
- [ ] Handle errors and invalid data

**Expected Output Format**:
```javascript
{
  id: "vehicle_123",
  line: "1",
  latitude: 59.3293,
  longitude: 18.0686,
  bearing: 45,
  timestamp: 1234567890,
  speed: 12.5  // m/s
}
```

### 2.2 API Service
Create `src/services/trafiklab.js`:
- [ ] Implement `getVehiclePositions(lineIds)` function
- [ ] Add error handling and retry logic
- [ ] Add request timeout (5 seconds)
- [ ] Log API quota usage

### 2.3 Testing
- [ ] Test with console.log output
- [ ] Verify data updates every 2 seconds
- [ ] Check line filtering works correctly

## Phase 3: Map Visualization (3-4 hours)

### 3.1 Map Component Setup
Create `src/components/Map.jsx`:
- [ ] Initialize Leaflet map
- [ ] Center on Stockholm (59.3293, 18.0686)
- [ ] Add OpenStreetMap tile layer
- [ ] Set appropriate zoom level (11-13)
- [ ] Add attribution

### 3.2 Bus Markers
Create `src/components/BusMarker.jsx`:
- [ ] Design bus icon (colored by line)
- [ ] Implement marker creation
- [ ] Add rotation/bearing display
- [ ] Add popup with bus info (line, speed, last update)

**Line Colors**:
- Line 1: Red
- Line 2: Blue
- Line 3: Green
- Line 4: Yellow

### 3.3 Marker Management
- [ ] Create marker registry (Map<vehicleId, Marker>)
- [ ] Update existing markers instead of recreating
- [ ] Remove markers for disappeared vehicles
- [ ] Smooth marker transitions (optional)

### 3.4 Map Controls
- [ ] Add zoom controls
- [ ] Add line filter toggles (show/hide lines)
- [ ] Add legend
- [ ] Add last update timestamp display

## Phase 4: Real-Time Updates (2-3 hours)

### 4.1 Custom Hook
Create `src/hooks/useRealtimeBuses.js`:
- [ ] Implement polling with setInterval
- [ ] Update frequency: 2000ms
- [ ] State management for buses
- [ ] Error state handling
- [ ] Loading state

### 4.2 Integration
- [ ] Connect hook to Map component
- [ ] Update markers on data change
- [ ] Show connection status indicator
- [ ] Handle API errors gracefully

### 4.3 Performance Optimization
- [ ] Debounce marker updates
- [ ] Only update changed positions
- [ ] Implement marker pooling (optional)

## Phase 5: UI/UX Polish (2-3 hours)

### 5.1 Styling
- [ ] Add Tailwind CSS or custom CSS
- [ ] Style map container (full viewport)
- [ ] Style control panel
- [ ] Style popups and tooltips
- [ ] Responsive design (mobile-friendly)

### 5.2 User Features
- [ ] Line filter checkboxes
- [ ] Bus count display per line
- [ ] Refresh rate indicator
- [ ] Manual refresh button
- [ ] Auto-pause when tab inactive

### 5.3 Error Handling UI
- [ ] Show connection errors
- [ ] API quota exceeded warning
- [ ] Retry mechanism with backoff
- [ ] Offline indicator

## Phase 6: Testing & Deployment (1-2 hours)

### 6.1 Testing
- [ ] Test with different line combinations
- [ ] Test error scenarios (network offline, invalid API key)
- [ ] Test performance with many buses
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsive testing

### 6.2 Documentation
- [ ] Add README.md with setup instructions
- [ ] Document API key setup
- [ ] Add screenshots
- [ ] Document known limitations

### 6.3 Deployment (Optional)
- [ ] Build production version (`npm run build`)
- [ ] Deploy to Vercel/Netlify/GitHub Pages
- [ ] Configure environment variables
- [ ] Test production build

## Timeline Summary
- **Phase 1**: 1-2 hours
- **Phase 2**: 2-3 hours
- **Phase 3**: 3-4 hours
- **Phase 4**: 2-3 hours
- **Phase 5**: 2-3 hours
- **Phase 6**: 1-2 hours

**Total Estimated Time**: 11-17 hours

## Success Criteria
- ✓ Map displays Stockholm area
- ✓ Buses from lines 1, 2, 3, 4 are visible
- ✓ Positions update every 2 seconds
- ✓ Markers show direction/bearing
- ✓ Can filter by line
- ✓ Handles errors gracefully
- ✓ Mobile responsive
- ✓ Attribution to Trafiklab and OpenStreetMap

## Future Enhancements (Optional)
- [ ] Historical bus tracks/trails
- [ ] Estimated arrival times at stops
- [ ] Bus route lines on map
- [ ] Stop locations
- [ ] Click bus to see details
- [ ] Search for specific bus
- [ ] Heatmap of bus density
- [ ] WebSocket backend for push updates
- [ ] PWA for offline capability
