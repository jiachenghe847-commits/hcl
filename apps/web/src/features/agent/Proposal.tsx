/**
 * The core screen: Haven's proposal and the disclosure preview.
 * Each item shows what the user said beside what the counsellor would see, and the user can switch each one off.
 * Nothing is booked until "Confirm". Items without a decision are withheld (fail closed, on the server too).
 */
import type { AgentRunCreated, AgentRunView } from '@haven/contracts';
import { useState } from 'react';
import { api, ApiError } from '../../api/client';
import { ToggleRow } from '../../app/controls';
import { useFeedback } from '../../app/feedback';
import { formatSlot } from '../../app/format';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { initials, MODE_LABEL } from '../booking/display';
import { AgentModeNote, useAgentRun } from './AgentStart';
import { Trace } from './Trace';

type Item = NonNullable<AgentRunCreated['proposal'] | AgentRunView['proposal']>['disclosure'][number];
const labelOf = (i: Item) => ('userLabel' in i ? i.userLabel : '');

export function Proposal() {
  const { t, state } = useStore();
  const nav = useNav();
  const { toast } = useFeedback();
  const current = useAgentRun();
  const run = current.value.run;
  const p = run?.proposal;
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((p?.disclosure ?? []).map((d) => [d.itemId, d.choice !== 'withhold'])),
  );
  const [busy, setBusy] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  if (!run || !p) return null;

  const held = new Date(p.slot.holdExpiresAt).toLocaleTimeString(state.lang === 'zh' ? 'zh-CN' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const sharing = p.disclosure.filter((d) => d.counsellorText && on[d.itemId]);

  const confirm = async () => {
    setBusy(true);
    try {
      const booking = await api.confirmAgent(run.id, {
        decisions: p.disclosure.filter((d) => d.counsellorText).map((d) => ({ itemId: d.itemId, choice: on[d.itemId] ? d.choice : 'withhold' })),
      });
      current.clear();
      nav.setStack([
        { name: 'home', params: {} },
        { name: 'booked', params: { id: booking.id } },
      ]);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'network';
      toast(t(code === 'hold_expired' || code === 'slot_unavailable' || code === 'conflict' ? 'holdExpired' : 'offline'));
      if (code !== 'network') nav.back();
    } finally {
      setBusy(false);
    }
  };

  const notNow = () => {
    api.cancelAgent(run.id).catch(() => undefined); // releases the hold; harmless if it already expired
    current.clear();
    nav.go('home', {}, { root: true });
  };

  return (
    <>
      <AgentModeNote />
      <p className="lead">{p.summary}</p>
      <div className="card">
        <div className="row">
          <div className="avatar">{initials(p.counsellor.displayName)}</div>
          <div>
            <b>{p.counsellor.displayName}</b>
            <div className="small">
              {formatSlot(p.slot.startsAt, state.lang, true)} · {t(MODE_LABEL[p.slot.mode])}
            </div>
          </div>
        </div>
        <span className="eyebrow">{t('whyMatch')}</span>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {p.counsellor.matchReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="small">
          {t('heldUntil')} {held}
        </p>
      </div>

      <h3>{t('disclosureTitle')}</h3>
      <p className="small">{t('disclosureLead')}</p>
      {p.disclosure.map((d) => (
        <div className="card" key={d.itemId} style={{ gap: 6 }}>
          {labelOf(d) && (
            <div className="small">
              <b>{t('youSaid')}:</b> {labelOf(d)}
            </div>
          )}
          <div>
            <span className="eyebrow">{t('counsellorSees')}</span>
            <p style={{ textDecoration: d.counsellorText && !on[d.itemId] ? 'line-through' : 'none', color: d.counsellorText && on[d.itemId] ? 'inherit' : 'var(--muted)' }}>
              {d.counsellorText ?? t('notShared')}
            </p>
          </div>
          <p className="small">{d.reason}</p>
          {d.counsellorText && (
            <ToggleRow id={`share-${d.itemId}`} label={t('shareThis')} checked={!!on[d.itemId]} onToggle={() => setOn((o) => ({ ...o, [d.itemId]: !o[d.itemId] }))} />
          )}
        </div>
      ))}
      {sharing.length === 0 && <p className="small">{t('sharingNothing')}</p>}

      <button className="btn" disabled={busy} onClick={confirm}>
        {t('confirmBooking')}
      </button>
      <button className="btn quiet" onClick={notNow}>
        {t('notNow')}
      </button>
      <button className="btn quiet" aria-expanded={showTrace} onClick={() => setShowTrace((v) => !v)}>
        {t('showTrace')}
      </button>
      {showTrace && <Trace steps={run.trace} />}
    </>
  );
}
