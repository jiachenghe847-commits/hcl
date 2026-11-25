/** Daily mood and energy check-in: three steps, then a tailored confirmation. Everything stays on the device. */
import { Bars, Face, Icon } from '../../app/icons';
import type { StringKey } from '../../app/i18n';
import { useDraft } from '../../app/draft';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { lowStreak, saveToday, tagsFor, todayEntry } from './logic';

interface CheckinDraft {
  mood?: number;
  energy?: number;
  tags: string[];
  note: string;
}
export const useCheckinDraft = () => useDraft<CheckinDraft>('checkin', { tags: [], note: '' });

/** Starts a check-in, prefilled with today's entry when updating it. */
export function useStartCheckin() {
  const { state } = useStore();
  const draft = useCheckinDraft();
  const nav = useNav();
  return () => {
    const te = todayEntry(state.checkins);
    draft.replace(te ? { mood: te.mood, energy: te.energy, tags: [...te.tags], note: te.note } : { tags: [], note: '' });
    nav.go('ciMood');
  };
}

function Progress({ n }: { n: number }) {
  const { t } = useStore();
  return (
    <div>
      <span className="small">
        {t('step')} {n} {t('of')} 3
      </span>
      <div className="progress" style={{ marginTop: 6 }}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= n ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

export function CheckinMood() {
  const { t } = useStore();
  const nav = useNav();
  const draft = useCheckinDraft();
  return (
    <>
      <Progress n={1} />
      <h2>{t('moodQ')}</h2>
      <div className="moods" role="group">
        {[1, 2, 3, 4, 5].map((m) => (
          <button key={m} className="mood" aria-pressed={draft.value.mood === m} onClick={() => draft.patch({ mood: m })}>
            <Face level={m} />
            <span>{t(`mood${m}` as StringKey)}</span>
          </button>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn" disabled={!draft.value.mood} onClick={() => nav.go('ciEnergy')}>
        {t('next')}
      </button>
    </>
  );
}

export function CheckinEnergy() {
  const { t } = useStore();
  const nav = useNav();
  const draft = useCheckinDraft();
  return (
    <>
      <Progress n={2} />
      <h2>{t('energyQ')}</h2>
      <div className="energy" role="group">
        {[5, 4, 3, 2, 1].map((e) => (
          <button key={e} aria-pressed={draft.value.energy === e} onClick={() => draft.patch({ energy: e })}>
            <Bars n={e} />
            <span>{t(`en${e}` as StringKey)}</span>
          </button>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn" disabled={!draft.value.energy} onClick={() => nav.go('ciTags')}>
        {t('next')}
      </button>
    </>
  );
}

export function CheckinTags() {
  const { t, state, update } = useStore();
  const nav = useNav();
  const draft = useCheckinDraft();
  const toggle = (k: string) =>
    draft.patch({ tags: draft.value.tags.includes(k) ? draft.value.tags.filter((x) => x !== k) : [...draft.value.tags, k] });
  const save = () => {
    const { mood, energy, tags, note } = draft.value;
    if (!mood || !energy) return;
    update((s) => ({ checkins: saveToday(s.checkins, { mood, energy, tags, note }) }));
    draft.clear();
    nav.go('ciDone', {}, { replace: true });
  };
  return (
    <>
      <Progress n={3} />
      <h2>{t('tagsQ')}</h2>
      <p className="lead">{t('tagsLead')}</p>
      <div className="chips">
        {tagsFor(state.role).map((k) => (
          <button key={k} className="chip" aria-pressed={draft.value.tags.includes(k)} onClick={() => toggle(k)}>
            {t(k)}
          </button>
        ))}
      </div>
      <label htmlFor="ci-note">
        <b>{t('noteLabel')}</b>
      </label>
      <textarea id="ci-note" placeholder={t('notePh')} value={draft.value.note} onChange={(e) => draft.patch({ note: e.target.value })} />
      <p className="note">
        <Icon.lock />
        {t('storedHere')}
      </p>
      <div className="spacer" />
      <button className="btn" onClick={save}>
        {t('save')}
      </button>
    </>
  );
}

export function CheckinDone() {
  const { t, state } = useStore();
  const nav = useNav();
  const te = todayEntry(state.checkins);
  const low = !!te && te.mood <= 2;
  return (
    <>
      <div style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 10, paddingTop: 8 }}>
        <Icon.check width={72} height={72} />
        <h2>{t('savedTitle')}</h2>
        <p className="lead">{t('savedLead')}</p>
      </div>
      {te?.mood === 1 && (
        <div className="card alert">
          <b>{t('unsafeT')}</b>
          <p className="small" style={{ color: 'var(--ink)' }}>
            {t('unsafeD')}
          </p>
          <button className="btn danger" onClick={() => nav.go('sos')}>
            {t('getHelp')}
          </button>
        </div>
      )}
      {lowStreak(state.checkins) && (
        <div className="card soft">
          <b>{t('streakT')}</b>
          <p className="small" style={{ color: 'var(--ink)' }}>
            {t('streakD')}
          </p>
          <button className="btn" onClick={() => nav.go('agentStart')}>
            {t('agentCardT')}
          </button>
          <button className="btn quiet" onClick={() => nav.go('book', {}, { root: true })}>
            {t('bookManually')}
          </button>
        </div>
      )}
      {low && (
        <div className="card">
          <b>{t('heavyDay')}</b>
          <p className="small">{t('heavyDayD')}</p>
          <button className="btn ghost" onClick={() => nav.go('breathe')}>
            {t('breathe1')}
          </button>
        </div>
      )}
      <div className="spacer" />
      <button className={`btn ${low ? 'quiet' : ''}`} onClick={() => nav.go('home', {}, { root: true })}>
        {t('backHome')}
      </button>
    </>
  );
}
