/** Book tab: counsellors from the API, filtered by language and session type, with each one's next free time. */
import type { Counsellor, Slot } from '@haven/contracts';
import { api } from '../../api/client';
import { formatSlot } from '../../app/format';
import { Icon } from '../../app/icons';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { useAsync } from '../../app/useAsync';
import { LoadState } from '../../app/LoadState';
import { FOCUS_LABEL, initials, languageLabel, MODE_LABEL } from './display';
import { useBookingDraft } from './state';

export function BookList() {
  const { t, state, update } = useStore();
  const nav = useNav();
  const draft = useBookingDraft();
  const f = state.filters;
  const load = useAsync(async () => {
    const counsellors = await api.counsellors();
    const slots = await Promise.all(counsellors.map((c) => api.openSlots(c.id)));
    return counsellors.map((c, i) => ({ c, next: slots[i]![0] as Slot | undefined }));
  }, []);

  const setFilter = (key: 'lang' | 'mode', v: string | null) => update((s) => ({ filters: { ...s.filters, [key]: v } }));
  const matches = (c: Counsellor) => (!f.lang || c.languages.includes(f.lang as never)) && (!f.mode || c.modes.includes(f.mode as never));

  return (
    <>
      <h2>{t('bookTitle')}</h2>
      <p className="lead">{t('bookLead')}</p>
      {state.role === 'staff' && (
        <p className="note">
          <Icon.shield />
          {t('staffNote')}
        </p>
      )}
      <div className="stack">
        <span className="eyebrow">{t('language')}</span>
        <div className="chips">
          {[null, 'en', 'zh', 'ms'].map((l) => (
            <button key={l ?? 'any'} className="chip" aria-pressed={f.lang === l} onClick={() => setFilter('lang', l)}>
              {l ? languageLabel(l, state.lang) : t('any')}
            </button>
          ))}
        </div>
      </div>
      <div className="stack">
        <span className="eyebrow">{t('mode')}</span>
        <div className="chips">
          {([null, 'in_person', 'video', 'chat'] as const).map((m) => (
            <button key={m ?? 'any'} className="chip" aria-pressed={f.mode === m} onClick={() => setFilter('mode', m)}>
              {m ? t(MODE_LABEL[m]) : t('any')}
            </button>
          ))}
        </div>
      </div>
      <LoadState load={load}>
        {(rows) => {
          const list = rows.filter((r) => matches(r.c));
          if (list.length === 0) return <p className="lead">{t('noMatch')}</p>;
          return list.map(({ c, next }) => (
            <button
              key={c.id}
              className="listbtn"
              onClick={() => {
                if (!draft.value.replaceBookingId) draft.clear();
                nav.go('counsellor', { id: c.id, name: c.displayName });
              }}
            >
              <div className="avatar">{initials(c.displayName)}</div>
              <div>
                <b>{c.displayName}</b>
                <div className="small">{c.focusAreas.map((a) => t(FOCUS_LABEL[a])).join(' · ')}</div>
                <div className="small">
                  {c.languages.map((l) => languageLabel(l, state.lang)).join(', ')} · {c.modes.map((m) => t(MODE_LABEL[m])).join(', ')}
                </div>
                <div className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  {t('nextFree')}: {next ? formatSlot(next.startsAt, state.lang) : '—'}
                </div>
              </div>
              <span className="chev">
                <Icon.chev />
              </span>
            </button>
          ));
        }}
      </LoadState>
      <p className="note">
        <Icon.info />
        {t('sampleCounsellors')}
      </p>
    </>
  );
}
