/**
 * Screen navigation: a stack of {name, params}, like the prototype.
 * Kept in memory on purpose: there are no URLs, so nothing about the user's state shows up in browser history.
 * Screens are registered in screens.tsx.
 */
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export interface Route {
  name: string;
  params: Record<string, string>;
}
export type Transition = 'in-r' | 'in-l' | 'fade';

interface Nav {
  current: Route;
  depth: number;
  transition: Transition;
  /** Increments on every navigation so the screen element re-mounts and replays its animation. */
  key: number;
  go: (name: string, params?: Record<string, string>, opts?: { root?: boolean; replace?: boolean }) => void;
  back: () => void;
  /** Replace the whole stack, e.g. home → booked so "back" lands on home. */
  setStack: (stack: Route[]) => void;
}

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const [stack, setStackState] = useState<Route[]>([initial]);
  const [transition, setTransition] = useState<Transition>('fade');
  const [key, setKey] = useState(0);

  const go = useCallback<Nav['go']>((name, params = {}, opts = {}) => {
    setStackState((s) => {
      const base = opts.root ? [] : opts.replace ? s.slice(0, -1) : s;
      return [...base, { name, params }];
    });
    setTransition(opts.root ? 'fade' : 'in-r');
    setKey((k) => k + 1);
  }, []);

  const back = useCallback(() => {
    setStackState((s) => (s.length > 1 ? s.slice(0, -1) : s));
    setTransition('in-l');
    setKey((k) => k + 1);
  }, []);

  const setStack = useCallback((next: Route[]) => {
    setStackState(next);
    setTransition('in-r');
    setKey((k) => k + 1);
  }, []);

  const value = useMemo<Nav>(
    () => ({ current: stack[stack.length - 1]!, depth: stack.length, transition, key, go, back, setStack }),
    [stack, transition, key, go, back, setStack],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const n = useContext(NavContext);
  if (!n) throw new Error('useNav outside NavProvider');
  return n;
}
