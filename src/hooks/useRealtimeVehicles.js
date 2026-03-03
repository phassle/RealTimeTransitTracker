import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchVehiclePositions } from '../services/trafiklab';

export function useRealtimeVehicles(operatorSlugs = ['sl'], baseInterval = 2000, enabled = true) {
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);
  const isActiveRef = useRef(true);

  const operatorKey = useMemo(() => operatorSlugs.slice().sort().join(','), [operatorSlugs]);

  const effectiveInterval = useMemo(
    () => Math.max(baseInterval, operatorSlugs.length * baseInterval),
    [operatorSlugs.length, baseInterval]
  );

  useEffect(() => {
    isActiveRef.current = true;

    const fetchData = async () => {
      try {
        const data = await fetchVehiclePositions(operatorSlugs);
        if (isActiveRef.current) {
          setVehicles(data);
          setError(null);
          setLastUpdate(new Date());
          setLoading(false);
        }
      } catch (err) {
        if (isActiveRef.current) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

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
      isActiveRef.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [effectiveInterval, enabled, operatorKey]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchVehiclePositions(operatorSlugs);
      setVehicles(data);
      setError(null);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return { vehicles, error, loading, lastUpdate, refresh, activeOperators: operatorSlugs, effectiveInterval };
}
