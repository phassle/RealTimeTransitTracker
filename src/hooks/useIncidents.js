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

  // Verifications a human marked, keyed by incident id. Kept here (not on the
  // clustered Incident, which is rebuilt fresh each poll) so they survive
  // re-derivation. Each is { webcamId, webcamName, verifiedAt }.
  const [verificationsById, setVerificationsById] = useState({});

  // Replay state. `replayTime` is the scrubbed past moment, or null when live.
  // Session bounds mirror the buffer's rolling window so the scrub control can
  // never imply history outside "since tab open, capped at the window".
  const [replayTime, setReplayTime] = useState(null);
  const [sessionRange, setSessionRange] = useState(null);

  // Each new poll (new vehicles reference) appends a snapshot and re-derives
  // incidents. Live polling keeps filling the buffer even while replaying.
  // `now` is read inside the effect; it is intentionally not a dep.
  useEffect(() => {
    const t = now();
    bufferRef.current.append({ time: t, vehicles });
    const anomalies = detectStationaryAnomalies(bufferRef.current.snapshots(), t);
    const next = clusterIncidents(incidentsRef.current, anomalies, t);
    incidentsRef.current = next;
    setIncidents(next);
    setSessionRange(bufferRef.current.range());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  const isReplaying = replayTime !== null;

  // While replaying, render the buffer's snapshot at the scrubbed moment;
  // otherwise the live vehicles. The marker lifecycle re-renders unchanged.
  const displayedVehicles = isReplaying
    ? bufferRef.current.at(replayTime)
    : vehicles;

  const replay = useMemo(() => ({
    isReplaying,
    viewedTime: replayTime,
    sessionStart: sessionRange?.start ?? null,
    sessionEnd: sessionRange?.end ?? null,
    // Scrub to a past moment, bounded to the session window so the view never
    // claims data from before the session started.
    scrubTo: (time) => {
      const range = bufferRef.current.range();
      if (!range) return;
      const clamped = Math.min(Math.max(time, range.start), range.end);
      setReplayTime(clamped);
    },
    returnToLive: () => setReplayTime(null),
  }), [isReplaying, replayTime, sessionRange]);

  const selectedIncident = useMemo(() => {
    const base = incidents.find((i) => i.id === selectedIncidentId) ?? null;
    if (!base) return null;
    return { ...base, verifications: verificationsById[base.id] ?? [] };
  }, [incidents, selectedIncidentId, verificationsById]);

  // Mark a Webcam as a Verification of the selected Incident; lands on the
  // Incident's timeline (PRD #84 story 21). No-op if nothing is selected.
  const verifyWebcam = (camera) => {
    if (!selectedIncidentId || !camera) return;
    const entry = { webcamId: camera.id, webcamName: camera.name, verifiedAt: now() };
    setVerificationsById((prev) => ({
      ...prev,
      [selectedIncidentId]: [...(prev[selectedIncidentId] ?? []), entry],
    }));
  };

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
    replay,
    displayedVehicles,
    verifyWebcam,
  };
}
