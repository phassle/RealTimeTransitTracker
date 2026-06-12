import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchVehiclePositions } from '../services/trafiklab';
import { useFetchState } from './useFetchState';

export function useRealtimeVehicles(operatorSlugs = ['sl'], baseInterval = 2000, enabled = true) {
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);
  const { data: vehicles, error, loading, run } = useFetchState([], true);

  const operatorKey = useMemo(() => operatorSlugs.slice().sort().join(','), [operatorSlugs]);

  const effectiveInterval = useMemo(
    () => Math.max(baseInterval, operatorSlugs.length * baseInterval),
    [operatorSlugs.length, baseInterval]
  );

  useEffect(() => {
    const fetchData = () => run(
      async () => ({ data: await fetchVehiclePositions(operatorSlugs), error: null }),
      () => setLastUpdate(new Date()),
    );

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

  const refresh = () => run(
    async () => ({ data: await fetchVehiclePositions(operatorSlugs), error: null }),
    () => setLastUpdate(new Date()),
  );

  return { vehicles: vehicles ?? [], error, loading, lastUpdate, refresh, activeOperators: operatorSlugs, effectiveInterval };
}
