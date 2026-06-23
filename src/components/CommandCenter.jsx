import { useMemo } from 'react';
import { Map } from './Map';
import { IncidentInbox } from './IncidentInbox';
import { IncidentDetail } from './IncidentDetail';
import { ReplayControls } from './ReplayControls';
import { FeedStatus } from './FeedStatus';
import { RecordingControls } from './RecordingControls';
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
    recording,
    displayedVehicles,
    verifyWebcam,
    injectIncident,
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

  // Downstream accent (PRD #136, stories 11/12): the deduped union of the
  // selected Incident projection's Downstream vehicles, surfaced through a
  // channel separate from the highlight so a forecast never reads as an
  // observation on the map. Empty when there is no projection — operator-subject
  // Incidents (projection always null) and retracted forecasts disappear for
  // free. The highlighted (stalled) vehicles are excluded so a vehicle is never
  // both selected and predicted.
  const predictedVehicleIds = useMemo(() => {
    const affected = selectedIncident?.projection?.affected;
    if (!affected) return [];
    const highlighted = new Set(highlightedVehicleIds);
    const ids = [];
    const seen = new Set();
    for (const a of affected) {
      for (const id of a.downstreamVehicleIds ?? []) {
        if (highlighted.has(id) || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [selectedIncident, highlightedVehicleIds]);

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
        <button
          type="button"
          className="command-center__inject"
          onClick={injectIncident}
        >
          ⚠ Inject demo incident
        </button>
      </aside>
      <main className="command-center__map" aria-label="Map">
        <MapComponent
          vehicles={displayedVehicles}
          center={center}
          zoom={zoom}
          theme={theme}
          highlightedVehicleIds={highlightedVehicleIds}
          predictedVehicleIds={predictedVehicleIds}
        />
        {selectedIncident?.demo && (
          <div className="command-center__demo-overlay" role="note">
            Demo incident — synthetic content
          </div>
        )}
        <ReplayControls replay={replay} />
        <RecordingControls recording={recording} />
      </main>
      <aside className="command-center__detail" aria-label="Incident detail">
        <IncidentDetail incident={selectedIncident} webcams={nearby} onVerify={verifyWebcam} />
      </aside>
    </div>
  );
}
