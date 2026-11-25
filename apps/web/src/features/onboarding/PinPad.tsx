/** Four-digit PIN keypad. Calls onComplete once four digits are entered. */
import { useState } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export function PinPad({ message, onComplete }: { message: string | null; onComplete: (code: string) => void }) {
  const [code, setCode] = useState('');
  const press = (k: string) => {
    const next = k === '⌫' ? code.slice(0, -1) : code.length < 4 ? code + k : code;
    setCode(next);
    if (next.length === 4 && k !== '⌫') setTimeout(() => onComplete(next), 150);
  };
  return (
    <>
      <div className="pindots" aria-live="polite" aria-label={`${code.length} of 4`}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < code.length ? 'on' : ''} />
        ))}
      </div>
      {message && (
        <p className="small" style={{ textAlign: 'center', color: 'var(--sos)' }} role="alert">
          {message}
        </p>
      )}
      <div className="keypad">
        {KEYS.map((k) =>
          k === '' ? (
            <span key="blank" className="key blank" aria-hidden />
          ) : (
            <button key={k} className="key" aria-label={k === '⌫' ? 'Delete' : k} onClick={() => press(k)}>
              {k}
            </button>
          ),
        )}
      </div>
    </>
  );
}
