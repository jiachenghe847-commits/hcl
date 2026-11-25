/** First launch: welcome → privacy promise → role → optional PIN; and the lock screen. */
import { useState } from 'react';
import { Face, Icon } from '../../app/icons';
import { useFeedback } from '../../app/feedback';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { LangSwitch } from '../../app/controls';
import { PinPad } from './PinPad';

export function Welcome() {
  const { t } = useStore();
  const nav = useNav();
  return (
    <>
      <div className="row" style={{ paddingTop: 16 }}>
        <div className="brand">
          <Icon.logo />
          <h3>{t('brand')}</h3>
        </div>
        <div className="spacer" />
        <LangSwitch />
      </div>
      <div className="welcome-art">
        <Face level={4} size={120} />
      </div>
      <h2>{t('tagline')}</h2>
      <div className="spacer" />
      <button className="btn" onClick={() => nav.go('privacy')}>
        {t('getStarted')}
      </button>
      <div className="row" style={{ justifyContent: 'center' }}>
        <span className="small">{t('needHelpNow')}</span>
        <button className="btn quiet" style={{ width: 'auto', color: 'var(--sos)' }} onClick={() => nav.go('sos')}>
          SOS
        </button>
      </div>
    </>
  );
}

export function Privacy() {
  const { t } = useStore();
  const nav = useNav();
  const items = [
    [Icon.lock, 'p1t', 'p1d'],
    [Icon.eye, 'p2t', 'p2d'],
    [Icon.shield, 'p3t', 'p3d'],
  ] as const;
  return (
    <>
      <h2>{t('privacyTitle')}</h2>
      <p className="lead">{t('privacyLead')}</p>
      <div className="stack" style={{ gap: 18 }}>
        {items.map(([Ic, a, b]) => (
          <div className="promise" key={a}>
            <div className="ic">
              <Ic />
            </div>
            <div>
              <b>{t(a)}</b>
              <p className="small">{t(b)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn" onClick={() => nav.go('role')}>
        {t('understand')}
      </button>
    </>
  );
}

export function Role() {
  const { t, state, update } = useStore();
  const nav = useNav();
  return (
    <>
      <h2>{t('roleTitle')}</h2>
      <p className="lead">{t('roleLead')}</p>
      {(['student', 'staff'] as const).map((r) => (
        <button key={r} className="rolecard" aria-pressed={state.role === r} onClick={() => update({ role: r })}>
          <b>{t(r)}</b>
          <span className="small">{t(r === 'student' ? 'studentD' : 'staffD')}</span>
        </button>
      ))}
      <div className="spacer" />
      <button className="btn" disabled={!state.role} onClick={() => nav.go('setpin')}>
        {t('continue')}
      </button>
    </>
  );
}

export function useFinishOnboarding() {
  const { update } = useStore();
  const nav = useNav();
  return () => {
    update({ onboarded: true });
    nav.go('home', {}, { root: true });
  };
}

export function SetPin() {
  const { t, update } = useStore();
  const { toast } = useFeedback();
  const finish = useFinishOnboarding();
  const [first, setFirst] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <h2>{t('lockTitle')}</h2>
      <p className="lead">{t(first ? 'confirmPin' : 'lockLead')}</p>
      <PinPad
        key={first ?? 'enter'}
        message={msg}
        onComplete={(code) => {
          if (!first) {
            setFirst(code);
            setMsg(null);
          } else if (code === first) {
            update({ pin: code, lockOn: true });
            finish();
            toast(t('lockOnToast'));
          } else {
            setFirst(null);
            setMsg(t('pinMismatch'));
          }
        }}
      />
      <button className="btn quiet" onClick={finish}>
        {t('skip')}
      </button>
    </>
  );
}

export function Lock() {
  const { t, state, update } = useStore();
  const nav = useNav();
  const [attempt, setAttempt] = useState(0);
  return (
    <>
      <div style={{ height: 40 }} />
      <div className="brand" style={{ justifyContent: 'center' }}>
        <Icon.logo />
        <h3>{t('brand')}</h3>
      </div>
      <h2 style={{ textAlign: 'center' }}>{t('unlockTitle')}</h2>
      <p className="lead" style={{ textAlign: 'center' }}>
        {t('enterPin')}
      </p>
      <PinPad
        key={attempt}
        message={attempt > 0 ? t('wrongPin') : null}
        onComplete={(code) => {
          if (code === state.pin) {
            update({ locked: false });
            nav.go('home', {}, { root: true });
          } else setAttempt((a) => a + 1);
        }}
      />
      <p className="small" style={{ textAlign: 'center' }}>
        {t('forgot')}
      </p>
      <button className="btn quiet" style={{ color: 'var(--sos)' }} onClick={() => nav.go('sos')}>
        SOS · {t('getHelp')}
      </button>
    </>
  );
}
