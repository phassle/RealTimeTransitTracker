import { useState, useEffect, useRef } from 'react';
import { fetchVehiclePositions } from '../services/trafiklab';

export function useRealtimeVehicles(interval = 2000, enabled = true) {
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;

    const fetchData = async () => {
      try {
        const data = await fetchVehiclePositions();
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
        intervalRef.current = setInterval(fetchData, interval);
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
  }, [interval, enabled]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchVehiclePositions();
      setVehicles(data);
      setError(null);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return { vehicles, error, loading, lastUpdate, refresh };
}
