/** SOS: emergency call, hold-to-alert campus security, helplines sorted by "open now", and simulated call screens. */
import { useEffect, useRef, useState } from 'react';
import { ToggleRow } from '../../app/controls';
import { useFeedback } from '../../app/feedback';
import { Icon } from '../../app/icons';
import type { StringKey } from '../../app/i18n';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { SERVICES, sortedServices } from './services';

const HOLD_MS = 2000;

function HoldButton({ onDone, label }: { onDone: () => void; label: string }) {
  const fill = useRef<HTMLSpanElement>(null);
  const start = useRef(0);
  const raf = useRef(0);
  const stop = () => {
    cancelAnimationFrame(raf.current);
    start.current = 0;
    if (fill.current) fill.current.style.transform = 'scaleX(0)';
  };
  const tick = (now: number) => {
    const p = Math.min(1, (now - start.current) / HOLD_MS);
    if (fill.current) fill.current.style.transform = `scaleX(${p})`;
    if (p >= 1) {
      stop();
      onDone();
    } else raf.current = requestAnimationFrame(tick);
  };
  const begin = () => {
    if (start.current) return;
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <button
      className="hold"
      aria-describedby="hold-hint"
      onPointerDown={begin}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyUp={stop}
      onBlur={stop}
      onClick={(e) => e.preventDefault()}
    >
      <span className="fill" ref={fill} />
      <span>{label}</span>
    </button>
  );
}

export function Sos() {
  const { t } = useStore();
  const nav = useNav();
  const { toast } = useFeedback();
  const services = sortedServices(new Date());
  const call = (id: string) => {
    const s = SERVICES.find((x) => x.id === id);
    if (!s?.open(new Date())) return toast(t('closedToast'));
    nav.go('calling', { id });
  };
  return (
    <>
      <p className="lead">{t('sosLead')}</p>
      <div className="card alert">
        <b>{t('danger')}</b>
        <button className="btn danger" onClick={() => call('999')}>
          <Icon.phone width={20} height={20} style={{ verticalAlign: -4, marginRight: 6 }} />
          {t('call999')}
        </button>
        <HoldButton label={t('holdAlert')} onDone={() => nav.go('alerted')} />
        <p className="small" id="hold-hint" style={{ color: 'var(--ink)' }}>
          {t('holdHint')}
        </p>
      </div>
      {services
        .filter((s) => s.id !== '999')
        .map((s) => (
          <div key={s.id} className={`svc ${s.isOpen ? '' : 'closed'}`}>
            <div className="name">{t(s.name)}</div>
            <button className="callbtn" aria-disabled={!s.isOpen} onClick={() => call(s.id)}>
              {t('call')}
            </button>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span className={`pill ${s.isOpen ? 'open' : 'closed'}`}>
                <span className="dot" />
                {t(s.isOpen ? 'openNow' : 'closedNow')}
              </span>
              <span className="small">{t(s.hours)}</span>
            </div>
          </div>
        ))}
      <details className="card">
        <summary>
          <b>{t('helpingFriend')}</b>
        </summary>
        <p className="small" style={{ marginTop: 8 }}>
          {t('friendTips')}
        </p>
      </details>
    </>
  );
}

const CUE: [StringKey, number][] = [
  ['inhale', 4000],
  ['hold', 4000],
  ['exhale', 6000],
];

/** Cycles "breathe in / hold / breathe out". */
export function useBreathCue(): [StringKey, number] {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setI((n) => n + 1), CUE[i % 3]![1]);
    return () => clearTimeout(id);
  }, [i]);
  return CUE[i % 3]!;
}

export function Calling({ id }: { id: string }) {
  const { t } = useStore();
  const nav = useNav();
  const s = SERVICES.find((x) => x.id === id) ?? SERVICES[0]!;
  const [connected, setConnected] = useState(false);
  const [shareLoc, setShareLoc] = useState(false);
  const [cue] = useBreathCue();
  useEffect(() => {
    const timer = setTimeout(() => setConnected(true), 2200);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <div style={{ textAlign: 'center', display: 'grid', gap: 6 }}>
        <span className="eyebrow">{connected ? t('connected') : `${t('calling')}…`}</span>
        <h2>{t(s.name)}</h2>
      </div>
      <div className="call-ring live">
        <Icon.phone />
      </div>
      <p className="note" style={{ justifyContent: 'center' }}>
        <Icon.info />
        {t('protoCall')}
      </p>
      <div className="card" style={{ textAlign: 'center' }}>
        <span className="small">{s.number ? t('toCallReal') : t('campusDemo')}</span>
        <div className="num">{s.number ?? '03-0000 0000'}</div>
      </div>
      <div className="card" style={{ gap: 0 }}>
        <ToggleRow id="shareLoc" label={t('shareLoc')} checked={shareLoc} onToggle={() => setShareLoc((v) => !v)} />
      </div>
      <div className="card soft" style={{ textAlign: 'center' }}>
        <p>{t('whileWait')}</p>
        <b style={{ fontFamily: 'var(--f-display)', fontSize: 20, color: 'var(--accent)' }}>{t(cue)}</b>
      </div>
      <button className="btn danger" onClick={nav.back}>
        {t('endCall')}
      </button>
    </>
  );
}

export function Alerted() {
  const { t } = useStore();
  const nav = useNav();
  const [cue] = useBreathCue();
  return (
    <>
      <div className="call-ring" style={{ background: 'var(--sos-soft)', color: 'var(--sos)' }}>
        <Icon.shield />
      </div>
      <h2 style={{ textAlign: 'center' }}>{t('alertedTitle')}</h2>
      <p className="lead" style={{ textAlign: 'center' }}>
        {t('alertedLead')}
      </p>
      <p className="note" style={{ justifyContent: 'center' }}>
        <Icon.info />
        {t('protoAlert')}
      </p>
      <div className="card soft" style={{ textAlign: 'center' }}>
        <p>{t('whileWait')}</p>
        <b style={{ fontFamily: 'var(--f-display)', fontSize: 20, color: 'var(--accent)' }}>{t(cue)}</b>
      </div>
      <button className="btn ghost" onClick={nav.back}>
        {t('back')}
      </button>
    </>
  );
}
