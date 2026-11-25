/** Renders loading, a retryable error, or the loaded data. */
import type { ReactNode } from 'react';
import { useStore } from './store';

interface Load<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

export function LoadState<T>({ load, children }: { load: Load<T>; children: (data: T) => ReactNode }) {
  const { t } = useStore();
  if (load.error) {
    return (
      <div className="card" role="alert">
        <p className="small">{t('offline')}</p>
        <button className="btn ghost" onClick={load.reload}>
          {t('retry')}
        </button>
      </div>
    );
  }
  if (load.loading || load.data === null) return <p className="small" aria-busy="true">{t('loading')}</p>;
  return <>{children(load.data)}</>;
}
