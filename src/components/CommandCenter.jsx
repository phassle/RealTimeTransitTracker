import { useMemo } from 'react';
import { Map } from './Map';
import { IncidentInbox } from './IncidentInbox';
import { IncidentDetail } from './IncidentDetail';
import { ReplayControls } from './ReplayControls';
import { FeedStatus } from './FeedStatus';
import { useIncidents } from '../hooks/useIncidents';
import { useWebcams } from '../hooks/useWebcams';
import { nearbyWebcams } from '../services/nearbyWebcams';
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
// `cameras` is injectable so tests can supply a fixed webcam list without the
// fetch; in the app it falls back to the curated/live webcam sources.
export function CommandCenter({ vehicles = [], feeds = [], theme = 'light', MapComponent = Map, now, cameras: camerasProp }) {
  const {
    incidents,
    feedStatuses,
    selectedIncidentId,
    selectIncident,
    selectedIncident,
    focus,
    replay,
    displayedVehicles,
    verifyWebcam,
  } = useIncidents(vehicles, { ...(now ? { now } : {}), feeds });

  // Fetch the webcam list once (only when not injected); no polling, no impact
  // on the feed budget. Nearby ranking is a pure derivation over the selection.
  const { cameras: fetchedCameras } = useWebcams(camerasProp === undefined);
  const cameras = camerasProp ?? fetchedCameras;
  const nearby = useMemo(
    () => nearbyWebcams(selectedIncident?.subject, cameras),
    [selectedIncident, cameras],
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
        <FeedStatus statuses={feedStatuses} />
      </aside>
      <main className="command-center__map">
        <MapComponent
          vehicles={displayedVehicles}
          center={center}
          zoom={zoom}
          theme={theme}
          highlightedVehicleIds={highlightedVehicleIds}
        />
        <ReplayControls replay={replay} />
      </main>
      <aside className="command-center__detail" aria-label="Incident detail">
        <IncidentDetail incident={selectedIncident} webcams={nearby} onVerify={verifyWebcam} />
      </aside>
    </div>
  );
}
