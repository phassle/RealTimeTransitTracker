# Real-Time Transit Tracker — Sweden

A real-time map showing public transport vehicles across Sweden with 2-second update frequency. Currently configured for Stockholm (SL), but the GTFS Sweden 3 API covers all of Sweden — the goal is to support any region by filtering vehicles within the selected map area.

## Features

- **Live tracking** of public transport vehicles in real time
- **Multiple transport modes**: Metro, Bus, Train, Tram, Ship, Ferry
- **Real-time updates** every 2 seconds
- **Color-coded** by transport mode
- **Clickable markers** with vehicle details
- **Filter by transport mode**
- **Live statistics** and vehicle counts

## Roadmap

- [ ] Support all of Sweden — show vehicles from any transit operator, not just SL
- [ ] Area-based filtering — only fetch/display vehicles within the current map viewport
- [ ] Operator selector — choose which transit authority to display

## Tech Stack

- **Frontend**: React 19 + Vite
- **Map**: Leaflet.js with OpenStreetMap tiles
- **Data**: Trafiklab GTFS-RT API (GTFS Sweden 3)
- **Parsing**: gtfs-realtime-bindings (Protocol Buffers)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Trafiklab API keys (see below)

### Get API Keys

1. Register a free account at https://developer.trafiklab.se/
2. Create a new project
3. Subscribe to the following APIs (Bronze tier is free):
   - **GTFS Sweden 3 Realtime** — live vehicle positions
   - **GTFS Regional Realtime** — regional real-time data
   - **GTFS Regional Static** — static schedule data (used by build scripts)
4. Copy the API keys from your project dashboard

### Installation

1. Clone and navigate to the project:
   ```bash
   cd RealTimeTransitTracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste your API keys.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000/ in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Data Sources

- **GTFS-RT Vehicle Positions**: Real-time GPS coordinates of public transport vehicles across Sweden
- **SL Transport API**: Line information and designations
- **OpenStreetMap**: Map tiles (free)

## API Usage

The app polls the GTFS-RT API every 2 seconds:
- **Bronze tier** (free): 50 calls/minute, 30,000 calls/month
- **Rate**: 30 calls/minute (one every 2 seconds)

## License

Data from Trafiklab under CC-BY 4.0 license.

## Attribution

- Data: [Trafiklab.se](https://trafiklab.se)
- Map: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
