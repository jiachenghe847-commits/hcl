/** Counsellor profile with mode, day and time pickers. Times come from the API's open slots. */
import { api } from '../../api/client';
import { campusParts } from '../../app/format';
import { DAY_NAMES } from '../../app/i18n';
import { LoadState } from '../../app/LoadState';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { useAsync } from '../../app/useAsync';
import { bio, FOCUS_LABEL, initials, languageLabel, MODE_LABEL, SESSION_TIMES, slotsByDay } from './display';
import { useBookingDraft } from './state';

export function CounsellorDetail({ id }: { id: string }) {
  const { t, state } = useStore();
  const nav = useNav();
  const draft = useBookingDraft();
  const load = useAsync(async () => {
    const [counsellors, slots] = await Promise.all([api.counsellors(), api.openSlots(id)]);
    const c = counsellors.find((x) => x.id === id);
    if (!c) throw new Error('not found');
    return { c, byDay: slotsByDay(slots) };
  }, [id]);

  return (
    <LoadState load={load}>
      {({ c, byDay }) => {
        const days = [...byDay.keys()].slice(0, 5);
        const d = draft.value.counsellorId === c.id ? draft.value : { note: '' };
        const preferredMode = state.filters.mode && c.modes.includes(state.filters.mode as never) ? (state.filters.mode as (typeof c.modes)[number]) : c.modes[0]!;
        const mode = d.mode && c.modes.includes(d.mode) ? d.mode : preferredMode;
        const day = d.day && byDay.has(d.day) ? d.day : days[0];
        const open = day ? (byDay.get(day) ?? []) : [];
        const pick = (p: Partial<typeof draft.value>) => draft.patch({ counsellorId: c.id, mode, day, ...p });
        return (
          <>
            <div className="row">
              <div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>
                {initials(c.displayName)}
              </div>
              <div>
                <h3>{c.displayName}</h3>
                <p className="small">{c.languages.map((l) => languageLabel(l, state.lang)).join(', ')}</p>
              </div>
            </div>
            <p>{bio(c, state.lang)}</p>
            <div className="chips">
              {c.focusAreas.map((a) => (
                <span key={a} className="pill">
                  {t(FOCUS_LABEL[a])}
                </span>
              ))}
            </div>
            <span className="eyebrow">{t('pickMode')}</span>
            <div className="segment">
              {c.modes.map((m) => (
                <button key={m} aria-pressed={mode === m} onClick={() => pick({ mode: m })}>
                  {t(MODE_LABEL[m])}
                </button>
              ))}
            </div>
            {days.length === 0 ? (
              <p className="lead">{t('noSlots')}</p>
            ) : (
              <>
                <span className="eyebrow">{t('pickDay')}</span>
                <div className="days">
                  {days.map((x) => {
                    const dt = new Date(`${x}T12:00:00`);
                    return (
                      <button key={x} className="day" aria-pressed={day === x} onClick={() => pick({ day: x, slotId: undefined, startsAt: undefined })}>
                        <span>{DAY_NAMES[state.lang][dt.getDay()]}</span>
                        <b>{dt.getDate()}</b>
                      </button>
                    );
                  })}
                </div>
                <span className="eyebrow">{t('pickTime')}</span>
                <div className="slots">
                  {SESSION_TIMES.map((tm) => {
                    const slot = open.find((s) => campusParts(s.startsAt).time === tm);
                    return (
                      <button
                        key={tm}
                        className="slot"
                        disabled={!slot}
                        aria-pressed={!!slot && d.slotId === slot.id}
                        onClick={() => slot && pick({ slotId: slot.id, startsAt: slot.startsAt })}
                      >
                        {tm}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <button
              className="btn"
              disabled={!(d.slotId && open.some((s) => s.id === d.slotId))}
              onClick={() => {
                draft.patch({ counsellorId: c.id, mode, day });
                nav.go('confirm', { name: c.displayName });
              }}
            >
              {t('reviewBooking')}
            </button>
          </>
        );
      }}
    </LoadState>
  );
}
