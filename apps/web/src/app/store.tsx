/**
 * Device-local app state, persisted in localStorage (DECISIONS.md D5): check-ins and notes never leave the phone.
 * Bookings are NOT here; they live on the server and are read through src/api.
 */
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { type Lang, type StringKey, translate } from './i18n';

export interface Checkin {
  /** Campus calendar date, YYYY-MM-DD. */
  d: string;
  mood: number;
  energy: number;
  tags: string[];
  note: string;
  /** Seeded demo data, labelled "Sample data" in the UI. */
  sample?: boolean;
}

export interface AppState {
  lang: Lang;
  role: 'student' | 'staff' | null;
  onboarded: boolean;
  pin: string | null;
  lockOn: boolean;
  locked: boolean;
  discreet: boolean;
  checkins: Checkin[];
  filters: { lang: string | null; mode: string | null };
}

const KEY = 'haven-app-v2';

export const isoDate = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function freshState(today = new Date()): AppState {
  const mood = [4, 3, 3, 4, 2, 2];
  const energy = [4, 3, 2, 3, 2, 2];
  const tags = [['tAssign'], ['tExams', 'tSleep'], ['tExams'], [], ['tMoney', 'tLonely'], ['tExams', 'tSleep']];
  return {
    lang: 'en',
    role: null,
    onboarded: false,
    pin: null,
    lockOn: false,
    locked: false,
    discreet: true,
    checkins: mood.map((m, i) => ({ d: isoDate(addDays(today, i - 6)), mood: m, energy: energy[i]!, tags: tags[i]!, note: '', sample: true })),
    filters: { lang: null, mode: null },
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...freshState(), ...(JSON.parse(raw) as Partial<AppState>) };
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return freshState();
}

interface Store {
  state: AppState;
  update: (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
  reset: () => void;
  t: (key: StringKey) => string;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const [state, setState] = useState<AppState>(() => initial ?? load());

  const update = useCallback<Store['update']>((patch) => {
    setState((s) => {
      const next = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked: keep working in memory */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setState(freshState());
  }, []);

  const t = useCallback((key: StringKey) => translate(state.lang, key), [state.lang]);
  const value = useMemo(() => ({ state, update, reset, t }), [state, update, reset, t]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
