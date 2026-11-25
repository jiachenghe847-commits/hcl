/** Toasts and confirm sheets, shared by every screen (ported from the prototype). */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface SheetAction {
  label: string;
  cls?: string;
  run?: () => void;
}
interface SheetSpec {
  title: string;
  body: string;
  actions: SheetAction[];
}

interface Feedback {
  toast: (msg: string) => void;
  sheet: (spec: SheetSpec) => void;
}

const FeedbackContext = createContext<Feedback | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sheetSpec, setSheetSpec] = useState<SheetSpec | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string) => {
    clearTimeout(timer.current);
    setToastMsg(msg);
    timer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);
  const value = useMemo(() => ({ toast, sheet: setSheetSpec }), [toast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {sheetSpec && <Sheet spec={sheetSpec} close={() => setSheetSpec(null)} />}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

function Sheet({ spec, close }: { spec: SheetSpec; close: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={spec.title}>
        <h3>{spec.title}</h3>
        <p className="lead">{spec.body}</p>
        {spec.actions.map((a, i) => (
          <button
            key={a.label}
            ref={i === 0 ? first : undefined}
            className={`btn ${a.cls ?? ''}`}
            onClick={() => {
              close();
              a.run?.();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function useFeedback(): Feedback {
  const f = useContext(FeedbackContext);
  if (!f) throw new Error('useFeedback outside FeedbackProvider');
  return f;
}
