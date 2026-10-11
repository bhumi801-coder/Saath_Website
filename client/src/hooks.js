import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Small fetch hook: { data, error, loading, reload }. Re-runs when `path` changes.
export function useApi(path, enabled = true) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !path) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, error: null, loading: true }));
    api(path)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }));
    return () => { cancelled = true; };
  }, [path, enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
