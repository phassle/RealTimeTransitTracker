import { useState, useRef, useEffect, useMemo } from 'react';
import { createObservationBuffer } from '../services/observationBuffer';
import { detectStationaryAnomalies } from '../services/anomalyRules';
import { clusterIncidents } from '../services/incidentClustering';

// useIncidents — wires the polling output (vehicle snapshots) through the
// command-center pipeline: observation buffer → anomaly rules → incident
// clustering. State ownership follows the established pattern: the hook owns
// it, components present it. Everything lives in memory (ADR 0003 / ADR 0001).
//
// Selecting an Incident exposes a `focus` (map centre + involved vehicle ids)
// so the view can focus the map on the subject and highlight the vehicles.
export function useIncidents(vehicles, { now = () => Date.now() } = {}) {
  const bufferRef = useRef(null);
  if (!bufferRef.current) bufferRef.current = createObservationBuffer();

  const incidentsRef = useRef([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  // Each new poll (new vehicles reference) appends a snapshot and re-derives
  // incidents. `now` is read inside the effect; it is intentionally not a dep.
  useEffect(() => {
    const t = now();
    bufferRef.current.append({ time: t, vehicles });
    const anomalies = detectStationaryAnomalies(bufferRef.current.snapshots(), t);
    const next = clusterIncidents(incidentsRef.current, anomalies, t);
    incidentsRef.current = next;
    setIncidents(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId],
  );

  const focus = useMemo(() => {
    if (!selectedIncident) return null;
    return {
      center: [selectedIncident.subject.latitude, selectedIncident.subject.longitude],
      vehicleIds: selectedIncident.vehicleIds,
    };
  }, [selectedIncident]);

  return {
    incidents,
    selectedIncidentId,
    selectIncident: setSelectedIncidentId,
    selectedIncident,
    focus,
  };
}
