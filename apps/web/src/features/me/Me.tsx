/** Me tab: role, sessions, preferences (language, app lock, reminders), privacy and data. */
import { forgetDevice } from '../../api/client';
import { LangSwitch, ToggleRow } from '../../app/controls';
import { useFeedback } from '../../app/feedback';
import { formatSlot } from '../../app/format';
import { Icon } from '../../app/icons';
import { LoadState } from '../../app/LoadState';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { initials, MODE_LABEL } from '../booking/display';
import { useMyBookings } from '../booking/state';
import { TEST_TASKS } from '../study/tasks';

export function useResetPrototype() {
  const { reset, t } = useStore();
  const nav = useNav();
  const { toast } = useFeedback();
  return () => {
    forgetDevice(); // a new anonymous identity: the next participant does not see earlier bookings
    reset();
    nav.go('welcome', {}, { root: true });
    toast(t('resetDone'));
  };
}

export function Me() {
  const { t, state, update } = useStore();
  const nav = useNav();
  const { toast, sheet } = useFeedback();
  const bookings = useMyBookings();
  const resetPrototype = useResetPrototype();

  return (
    <>
      <h2>{t('meTitle')}</h2>
      <div className="stack">
        <span className="eyebrow">{t('iAm')}</span>
        <div className="segment">
          {(['student', 'staff'] as const).map((r) => (
            <button key={r} aria-pressed={state.role === r} onClick={() => update({ role: r })}>
              {t(r)}
            </button>
          ))}
        </div>
      </div>
      <div className="stack">
        <span className="eyebrow">{t('mySessions')}</span>
        <LoadState load={bookings}>
          {(list) =>
            list.length ? (
              list.map((b) => (
                <button key={b.id} className="listbtn" onClick={() => nav.go('session', { id: b.id })}>
                  <div className="avatar">{initials(b.counsellor.displayName)}</div>
                  <div>
                    <b>{formatSlot(b.slot.startsAt, state.lang)}</b>
                    <div className="small">
                      {b.counsellor.displayName} · {t(MODE_LABEL[b.slot.mode])}
                    </div>
                  </div>
                  <span className="chev">
                    <Icon.chev />
                  </span>
                </button>
              ))
            ) : (
              <p className="small">{t('noSession')}</p>
            )
          }
        </LoadState>
      </div>
      <div className="stack">
        <span className="eyebrow">{t('prefs')}</span>
        <div className="card" style={{ gap: 0 }}>
          <div className="toggle">
            <div className="txt">
              <b>{t('language')}</b>
            </div>
            <LangSwitch />
          </div>
          <ToggleRow
            id="lockOn"
            label={t('appLock')}
            desc={t('appLockD')}
            checked={state.lockOn}
            onToggle={() => (state.pin ? update((s) => ({ lockOn: !s.lockOn })) : nav.go('setpin'))}
          />
          <ToggleRow id="discreet" label={t('discreet')} desc={t('discreetD')} checked={state.discreet} onToggle={() => update((s) => ({ discreet: !s.discreet }))} />
          {state.lockOn && state.pin && (
            <div className="toggle">
              <button
                className="btn quiet"
                style={{ width: 'auto', padding: 0 }}
                onClick={() => {
                  update({ locked: true });
                  nav.go('lock', {}, { root: true });
                }}
              >
                {t('lockNow')}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="stack">
        <span className="eyebrow">{t('privacyData')}</span>
        <div className="card">
          <b>{t('whatStored')}</b>
          <p className="small">
            {t('p1d')} {t('p2d')} {t('p3d')}
          </p>
          <button
            className="btn ghost"
            style={{ color: 'var(--sos)', borderColor: 'var(--sos)' }}
            onClick={() =>
              sheet({
                title: t('deleteQ'),
                body: t('deleteD'),
                actions: [
                  {
                    label: t('delete'),
                    cls: 'danger',
                    run: () => {
                      update({ checkins: [] });
                      toast(t('deleted'));
                    },
                  },
                  { label: t('cancel'), cls: 'quiet' },
                ],
              })
            }
          >
            {t('deleteCheckins')}
          </button>
        </div>
      </div>
      <div className="stack mobile-only">
        <span className="eyebrow">{t('protoPanel')}</span>
        <div className="card">
          <b>{t('testTasks')}</b>
          <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
            {TEST_TASKS.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ol>
          <button className="btn ghost" onClick={() => nav.go('counsellorView')}>
            {t('counsellorViewT')}
          </button>
          <button className="btn quiet" onClick={resetPrototype}>
            {t('resetDemo')}
          </button>
        </div>
      </div>
    </>
  );
}
