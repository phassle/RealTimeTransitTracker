import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Shared fetch-state core: loading/error/data state machine with alive-guard built in.
 * Both the vehicle hook (polling) and the webcam hook (fetch-once) use this as their
 * state plumbing; their distinct lifecycles stay in their respective hooks.
 */
export function useFetchState(initialData = null, initialLoading = false) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(initialLoading);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /**
   * Guarded executor. asyncFn must return { data, error: string|null } or throw.
   * State updates are suppressed if the hook has unmounted before asyncFn resolves.
   * onSuccess is called (synchronously, still inside the alive check) only on clean success.
   */
  const run = useCallback(async (asyncFn, onSuccess) => {
    setLoading(true);
    try {
      const { data: newData, error: newError = null } = await asyncFn();
      if (!aliveRef.current) return;
      setData(newData);
      setError(newError);
      if (newError === null) onSuccess?.();
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err?.message || String(err));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  return { data, error, loading, run };
}
