/**
 * In-memory drafts that span several screens (a check-in in progress, a booking being chosen).
 * Never persisted: an unfinished draft disappears when the app closes, which is the private default.
 */
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type Drafts = Record<string, unknown>;
interface DraftStore {
  drafts: Drafts;
  set: (key: string, next: (prev: unknown) => unknown) => void;
}

const DraftContext = createContext<DraftStore | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const set = useCallback((key: string, next: (prev: unknown) => unknown) => setDrafts((d) => ({ ...d, [key]: next(d[key]) })), []);
  const value = useMemo(() => ({ drafts, set }), [drafts, set]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

/** A typed draft slot. `patch` merges; `clear` resets to the initial value. */
export function useDraft<T extends object>(key: string, initial: T) {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft outside DraftProvider');
  const value = (ctx.drafts[key] as T | undefined) ?? initial;
  return {
    value,
    patch: (p: Partial<T>) => ctx.set(key, (prev) => ({ ...((prev as T | undefined) ?? initial), ...p })),
    replace: (v: T) => ctx.set(key, () => v),
    clear: () => ctx.set(key, () => initial),
  };
}
