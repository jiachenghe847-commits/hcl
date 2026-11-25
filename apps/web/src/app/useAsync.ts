/** Loads async data for a screen, with loading / error / reload. Ignores results that arrive after unmount. */
import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    load().then(
      (d) => live && (setData(d), setLoading(false)),
      (e: unknown) => live && (setError(e), setLoading(false)),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}
