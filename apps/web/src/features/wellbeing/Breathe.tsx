/** One-minute paced breathing: in 4 s, hold 4 s, out 6 s. Respects reduced motion. */
import { useEffect, useState } from 'react';
import type { StringKey } from '../../app/i18n';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';

const PHASES: [StringKey, number, number][] = [
  ['inhale', 4000, 1.25],
  ['hold', 4000, 1.25],
  ['exhale', 6000, 0.85],
];

export function Breathe() {
  const { t } = useStore();
  const nav = useNav();
  const [i, setI] = useState(0);
  // Start unscaled, then scale on the next frame so the first inhale animates too.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const [word, ms, scale] = PHASES[i % 3]!;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const id = setTimeout(() => setI((n) => n + 1), ms);
    return () => clearTimeout(id);
  }, [i, ms]);
  return (
    <>
      <p className="lead" style={{ textAlign: 'center' }}>
        {t('breatheLead')}
      </p>
      <div className="breath" style={{ transitionDuration: `${ms}ms`, transform: reduce || !mounted ? undefined : `scale(${scale})` }}>
        <b>{t(word)}</b>
      </div>
      <div className="spacer" />
      <button className="btn" onClick={nav.back}>
        {t('finish')}
      </button>
    </>
  );
}
