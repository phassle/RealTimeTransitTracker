import { Map } from './Map';
import { IncidentInbox } from './IncidentInbox';
import { IncidentDetail } from './IncidentDetail';
import { useIncidents } from '../hooks/useIncidents';
import { SWEDEN_CENTER } from '../config/operators';
import './CommandCenter.css';

const INCIDENT_FOCUS_ZOOM = 14;

// Command Center view — left: Incident Inbox, center: map, right: Incident
// detail (Why-flagged evidence panel + timeline). The existing map view is
// untouched; this is an additive, separate view (PRD #84). Selecting an
// Incident focuses the map on its subject and highlights involved vehicles.
//
// `MapComponent` is injectable so tests can assert the focus wiring without a
// real Leaflet instance. `now` is forwarded to useIncidents for deterministic
// tests.
export function CommandCenter({ vehicles = [], theme = 'light', MapComponent = Map, now }) {
  const { incidents, selectedIncidentId, selectIncident, selectedIncident, focus } = useIncidents(
    vehicles,
    now ? { now } : undefined,
  );

  const center = focus ? focus.center : SWEDEN_CENTER;
  const zoom = focus ? INCIDENT_FOCUS_ZOOM : 6;
  const highlightedVehicleIds = focus ? focus.vehicleIds : [];

  return (
    <div className="command-center">
      <aside className="command-center__inbox" aria-label="Incident inbox">
        <h2 className="command-center__title">Incidents</h2>
        <IncidentInbox
          incidents={incidents}
          selectedIncidentId={selectedIncidentId}
          onSelect={selectIncident}
        />
      </aside>
      <main className="command-center__map">
        <MapComponent
          vehicles={vehicles}
          center={center}
          zoom={zoom}
          theme={theme}
          highlightedVehicleIds={highlightedVehicleIds}
        />
      </main>
      <aside className="command-center__detail" aria-label="Incident detail">
        <IncidentDetail incident={selectedIncident} />
      </aside>
    </div>
  );
}
