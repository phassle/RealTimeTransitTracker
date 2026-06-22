import { useState, useRef, useEffect, useMemo } from 'react';
import { createObservationBuffer } from '../services/observationBuffer';
import { detectStationaryAnomalies, learnDwellSpots } from '../services/anomalyRules';
import { detectFeedOutageAnomalies } from '../services/feedOutageRules';
import { clusterIncidents } from '../services/incidentClustering';
import { predictImpact } from '../services/etaProjection';
import { buildInjectedAnomalies } from '../services/injectedIncident';
import { operatorFeedStatuses } from '../services/feedStatus';
import { OPERATORS, OPERATOR_MAP, SWEDEN_CENTER } from '../config/operators';

// useIncidents — wires the polling output (vehicle snapshots) through the
// command-center pipeline: observation buffer → anomaly rules → incident
// clustering. State ownership follows the established pattern: the hook owns
// it, components present it. Everything lives in memory (ADR 0003 / ADR 0001).
//
// Selecting an Incident exposes a `focus` (map centre + involved vehicle ids)
// so the view can focus the map on the subject and highlight the vehicles.
export function useIncidents(vehicles, { now = () => Date.now(), feeds = [] } = {}) {
  const bufferRef = useRef(null);
  if (!bufferRef.current) bufferRef.current = createObservationBuffer();

  // Latest per-operator fetch outcomes, read inside the poll effect. Kept in a
  // ref so the effect (keyed on the vehicles reference, which changes with each
  // poll) always sees the matching feeds without a stale closure.
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;

  const incidentsRef = useRef([]);
  const [incidents, setIncidents] = useState([]);
  const [feedStatuses, setFeedStatuses] = useState(() => operatorFeedStatuses(feeds, OPERATORS));
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
    const currentFeeds = feedsRef.current;
    bufferRef.current.append({ time: t, vehicles, feeds: currentFeeds });
    const snapshots = bufferRef.current.snapshots();
    // Dwell spots are learned from the session buffer and suppress stationary
    // detections at habitual stops (terminals, depots) — PRD #84 story 7.
    const dwellSpots = learnDwellSpots(snapshots);
    const anomalies = [
      ...detectStationaryAnomalies(snapshots, t, { dwellSpots }),
      ...detectFeedOutageAnomalies(snapshots, t),
    ];
    const next = clusterIncidents(incidentsRef.current, anomalies, t);
    incidentsRef.current = next;
    setIncidents(next);
    setFeedStatuses(operatorFeedStatuses(currentFeeds, OPERATORS));
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
    // Expected impact Projection: a transient, forward-looking forecast derived
    // per poll for the selected Incident only. It is NOT an Anomaly and never
    // joins the timeline — it is recomputed from the live buffer each render and
    // becomes null the moment the disruption clears (ADR 0005, PRD #136).
    const range = bufferRef.current.range();
    const projection = predictImpact(base, bufferRef.current, range?.end ?? now());
    return { ...base, verifications: verificationsById[base.id] ?? [], projection };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Inject a demo Incident (PRD #84 stories 26–28). Synthetic anomalies enter
  // through the SAME clustering seam as real detections, carrying a `demo`
  // marker that survives into every presenter, so the audience sees the real
  // pipeline (inbox → map → panel → timeline → webcams) — just with seeded
  // input. Live, non-injected incidents are untouched.
  const injectIncident = () => {
    const t = now();
    const next = clusterIncidents(incidentsRef.current, buildInjectedAnomalies(t), t);
    incidentsRef.current = next;
    setIncidents(next);
  };

  // Recording export/import (PRD #84 stories 25, 30). Export serializes the
  // buffer to a versioned envelope for the operator to save to disk. Import
  // loads such a file back so Replay can scrub the captured window; it
  // validates before mutating, so a malformed/wrong-version file throws and
  // leaves the live buffer and Incidents untouched.
  const recording = useMemo(() => ({
    export: () => bufferRef.current.exportRecording(),
    import: (input) => {
      bufferRef.current.importRecording(input); // throws on invalid; no mutation
      const range = bufferRef.current.range();
      const t = range ? range.end : now();
      const snapshots = bufferRef.current.snapshots();
      const anomalies = detectStationaryAnomalies(snapshots, t, {
        dwellSpots: learnDwellSpots(snapshots),
      });
      const next = clusterIncidents([], anomalies, t);
      incidentsRef.current = next;
      setIncidents(next);
      setSessionRange(range);
      setReplayTime(null);
      setSelectedIncidentId(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const focus = useMemo(() => {
    if (!selectedIncident) return null;
    const subject = selectedIncident.subject;
    // Operator-subject (feed outage) Incidents carry no ground geometry: indicate
    // the operator's REGION, never a traffic point, and present as a data problem.
    if (subject.kind === 'operator') {
      const op = OPERATOR_MAP.get(subject.operator);
      return {
        center: op ? op.center : SWEDEN_CENTER,
        vehicleIds: [],
        isDataProblem: true,
      };
    }
    return {
      center: [subject.latitude, subject.longitude],
      vehicleIds: selectedIncident.vehicleIds,
      isDataProblem: false,
    };
  }, [selectedIncident]);

  return {
    incidents,
    feedStatuses,
    selectedIncidentId,
    selectIncident: setSelectedIncidentId,
    selectedIncident,
    focus,
    replay,
    recording,
    displayedVehicles,
    verifyWebcam,
    injectIncident,
  };
}
