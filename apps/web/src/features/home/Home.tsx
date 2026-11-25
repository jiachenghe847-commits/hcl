/** Home tab: today's check-in, next session (from the API), this week's moods, quick tools. */
import { DAY_NAMES, type StringKey } from '../../app/i18n';
import { formatSlot } from '../../app/format';
import { Face, Icon } from '../../app/icons';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { initials, MODE_LABEL } from '../booking/display';
import { useMyBookings } from '../booking/state';
import { lastSevenDays, todayEntry } from '../checkin/logic';
import { useStartCheckin } from '../checkin/screens';

function greeting(): StringKey {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

export function Home() {
  const { t, state } = useStore();
  const nav = useNav();
  const startCheckin = useStartCheckin();
  const bookings = useMyBookings();
  const te = todayEntry(state.checkins);
  const next = bookings.data?.[0];

  return (
    <>
      <h2>{t(greeting())}</h2>
      {te ? (
        <div className="card">
          <div className="row">
            <Face level={te.mood} size={48} />
            <div style={{ flex: 1 }}>
              <b>{t('doneToday')}</b>
              <p className="small">
                {t(`mood${te.mood}` as StringKey)} · {t(`en${te.energy}` as StringKey)}
              </p>
            </div>
            <button className="btn ghost" style={{ width: 'auto', minHeight: 40 }} onClick={startCheckin}>
              {t('editToday')}
            </button>
          </div>
        </div>
      ) : (
        <div className="card soft">
          <h3>{t('howToday')}</h3>
          <p className="small">{t('ciTakes')}</p>
          <button className="btn" onClick={startCheckin}>
            {t('startCheckin')}
          </button>
        </div>
      )}
      <div className="card soft">
        <h3>{t('agentCardT')}</h3>
        <p className="small" style={{ color: 'var(--ink)' }}>
          {t('agentCardD')}
        </p>
        <button className="btn ghost" onClick={() => nav.go('agentStart')}>
          {t('agentStart')}
        </button>
      </div>
      {next ? (
        <button className="listbtn" onClick={() => nav.go('session', { id: next.id })}>
          <div className="avatar">{initials(next.counsellor.displayName)}</div>
          <div>
            <span className="eyebrow">{t('upcoming')}</span>
            <div>
              <b>{formatSlot(next.slot.startsAt, state.lang)}</b>
            </div>
            <div className="small">
              {next.counsellor.displayName} · {t(MODE_LABEL[next.slot.mode])}
            </div>
          </div>
          <span className="chev">
            <Icon.chev />
          </span>
        </button>
      ) : (
        !bookings.loading && (
          <div className="card">
            <b>{t('noSession')}</b>
            <p className="small">{t('noSessionD')}</p>
            <button className="btn ghost" onClick={() => nav.go('book', {}, { root: true })}>
              {t('findCounsellor')}
            </button>
          </div>
        )
      )}
      <div className="card">
        <div className="row">
          <h3>{t('thisWeek')}</h3>
          <div className="spacer" />
          {state.checkins.some((c) => c.sample) && <span className="sample">{t('sampleData')}</span>}
        </div>
        <div className="week">
          {lastSevenDays(state.checkins).map(({ d, entry }, i) => (
            <div key={d} className={`d ${i === 6 ? 'today' : ''}`}>
              {entry ? <Face level={entry.mood} size={28} /> : <span className="blob" />}
              <span>{DAY_NAMES[state.lang][new Date(`${d}T12:00:00`).getDay()]}</span>
            </div>
          ))}
        </div>
      </div>
      <h3>{t('quickTools')}</h3>
      <button className="listbtn" onClick={() => nav.go('breathe')}>
        <div className="avatar">
          <Icon.wind width={24} height={24} />
        </div>
        <div>
          <b>{t('breathe1')}</b>
          <div className="small">{t('breathe1d')}</div>
        </div>
        <span className="chev">
          <Icon.chev />
        </span>
      </button>
    </>
  );
}
