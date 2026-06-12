import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchOperatorFeeds } from '../services/trafiklab';
import { useFetchState } from './useFetchState';

export function useRealtimeVehicles(operatorSlugs = ['sl'], baseInterval = 2000, enabled = true) {
  const [lastUpdate, setLastUpdate] = useState(null);
  const [feedOutcomes, setFeedOutcomes] = useState([]);
  const outcomesRef = useRef([]);
  const intervalRef = useRef(null);
  const { data: vehicles, error, loading, run } = useFetchState([], true);

  // One fetch path for poll + manual refresh. Returns vehicles to useFetchState
  // and stashes the per-operator fetch outcomes (recorded in the buffer by the
  // command center to drive feed-outage detection — no extra feed calls).
  const fetchFeeds = () => run(
    async () => {
      const { vehicles, outcomes } = await fetchOperatorFeeds(operatorSlugs);
      outcomesRef.current = outcomes;
      return { data: vehicles, error: null };
    },
    () => {
      setLastUpdate(new Date());
      setFeedOutcomes(outcomesRef.current);
    },
  );

  const operatorKey = useMemo(() => operatorSlugs.slice().sort().join(','), [operatorSlugs]);

  const effectiveInterval = useMemo(
    () => Math.max(baseInterval, operatorSlugs.length * baseInterval),
    [operatorSlugs.length, baseInterval]
  );

  useEffect(() => {
    const fetchData = () => fetchFeeds();

    const startPolling = () => {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchData, effectiveInterval);
      }
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchData();
        startPolling();
      }
    };

    if (enabled) {
      fetchData();
      startPolling();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [effectiveInterval, enabled, operatorKey, run]);

  const refresh = () => fetchFeeds(run);

  return { vehicles: vehicles ?? [], feedOutcomes, error, loading, lastUpdate, refresh, activeOperators: operatorSlugs, effectiveInterval };
}
