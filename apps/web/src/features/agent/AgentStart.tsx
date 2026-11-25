/** "Let Haven find a counsellor": message, preferences, do-not-share names; crisis → SOS, else start a run. */
import type { AgentRunCreated, AgentRunView, Language, Mode } from '@haven/contracts';
import { useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '../../api/client';
import { useDraft } from '../../app/draft';
import { useFeedback } from '../../app/feedback';
import { Icon } from '../../app/icons';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { useAsync } from '../../app/useAsync';
import { languageLabel, MODE_LABEL } from '../booking/display';
import { type AgentForm, prepareAgentRequest } from './prepare';

/** The run currently on screen. Only the create response carries the user-side labels, so it is kept in memory. */
export const useAgentRun = () => useDraft<{ run?: AgentRunCreated | AgentRunView }>('agentRun', {});

export function AgentModeNote() {
  const { t } = useStore();
  const health = useAsync(() => api.health(), []);
  if (health.data?.agentMode !== 'scripted') return null;
  return (
    <p className="note" role="note">
      <Icon.info />
      {t('agentDemo')}
    </p>
  );
}

export function AgentStart() {
  const { t, state } = useStore();
  const nav = useNav();
  const { toast } = useFeedback();
  const current = useAgentRun();
  const health = useAsync(() => api.health(), []);
  const [form, setForm] = useState<AgentForm>({ message: '', languages: [], modes: [], availability: '', doNotShare: '' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'failed' | 'unavailable' | null>(null);
  const key = useRef(newIdempotencyKey());
  const unavailable = failed === 'unavailable' || health.data?.agentMode === 'none';

  const toggle = <K extends 'languages' | 'modes'>(k: K, v: AgentForm[K][number]) =>
    setForm((f) => ({ ...f, [k]: (f[k] as string[]).includes(v) ? (f[k] as string[]).filter((x) => x !== v) : [...f[k], v] }));

  const start = async () => {
    const prepared = prepareAgentRequest(state, form);
    if (prepared.kind === 'crisis') {
      nav.go('sos', {}, { replace: true });
      toast(t('unsafeD'));
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      const run = await api.startAgent(prepared.request, key.current);
      key.current = newIdempotencyKey(); // the next attempt is a new run
      if (run.status === 'crisis') {
        nav.go('sos', {}, { replace: true });
        toast(t('unsafeD'));
      } else if (run.status === 'proposed' && run.proposal) {
        current.replace({ run });
        nav.go('agentProposal');
      } else setFailed('failed');
    } catch (e) {
      setFailed(e instanceof ApiError && (e.code === 'llm_unavailable' || e.code === 'rate_limited') ? 'unavailable' : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>{t('agentCardT')}</h2>
      <p className="lead">{t('agentLead')}</p>
      <AgentModeNote />
      <label htmlFor="ag-msg">
        <b>{t('agentMsgLabel')}</b>
      </label>
      <textarea id="ag-msg" placeholder={t('agentMsgPh')} maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <span className="eyebrow">{t('agentPrefs')}</span>
      <div className="chips" aria-label={t('language')}>
        {(['en', 'zh', 'ms'] as Language[]).map((l) => (
          <button key={l} className="chip" aria-pressed={form.languages.includes(l)} onClick={() => toggle('languages', l)}>
            {languageLabel(l, state.lang)}
          </button>
        ))}
      </div>
      <div className="chips" aria-label={t('mode')}>
        {(['in_person', 'video', 'chat'] as Mode[]).map((m) => (
          <button key={m} className="chip" aria-pressed={form.modes.includes(m)} onClick={() => toggle('modes', m)}>
            {t(MODE_LABEL[m])}
          </button>
        ))}
      </div>
      <label htmlFor="ag-when">
        <b>{t('availabilityLabel')}</b>
      </label>
      <input
        id="ag-when"
        className="chip"
        style={{ borderRadius: 12, textAlign: 'left' }}
        placeholder={t('availabilityPh')}
        maxLength={200}
        value={form.availability}
        onChange={(e) => setForm({ ...form, availability: e.target.value })}
      />
      <label htmlFor="ag-names">
        <b>{t('doNotShareLabel')}</b>
        <div className="small">{t('doNotShareD')}</div>
      </label>
      <input
        id="ag-names"
        className="chip"
        style={{ borderRadius: 12, textAlign: 'left' }}
        value={form.doNotShare}
        onChange={(e) => setForm({ ...form, doNotShare: e.target.value })}
      />
      <p className="note">
        <Icon.shield />
        {t('agentRedactNote')}
      </p>
      {(failed || unavailable) && (
        <div className="card" role="alert">
          <p className="small">{t(unavailable ? 'agentUnavailable' : 'agentFailed')}</p>
          <button className="btn ghost" onClick={() => nav.go('book', {}, { root: true })}>
            {t('bookManually')}
          </button>
        </div>
      )}
      <button className="btn" disabled={busy || unavailable} aria-busy={busy} onClick={start}>
        {busy ? t('agentWorking') : t('agentStart')}
      </button>
    </>
  );
}
