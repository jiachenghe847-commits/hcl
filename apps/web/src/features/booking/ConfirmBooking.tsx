/**
 * Review and confirm a manual booking.
 * The optional note is redacted on the device before it is sent (S3). The server checks it again (S7).
 * Rescheduling books the new time first and cancels the old booking only after that succeeds, so a failure never leaves the user with nothing.
 */
import { redactIdentifiers } from '@haven/safety';
import { useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '../../api/client';
import { ToggleRow } from '../../app/controls';
import { useFeedback } from '../../app/feedback';
import { formatSlot } from '../../app/format';
import { Icon } from '../../app/icons';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { MODE_LABEL } from './display';
import { useBookingDraft } from './state';

export function ConfirmBooking({ name }: { name: string }) {
  const { t, state, update } = useStore();
  const nav = useNav();
  const { toast } = useFeedback();
  const draft = useBookingDraft();
  const d = draft.value;
  const [busy, setBusy] = useState(false);
  if (!d.slotId || !d.startsAt || !d.mode) return null;
  const redaction = redactIdentifiers(d.note.trim());

  const confirm = async () => {
    const key = d.idempotencyKey ?? newIdempotencyKey();
    if (!d.idempotencyKey) draft.patch({ idempotencyKey: key });
    setBusy(true);
    try {
      const items = redaction.text ? [{ kind: 'shared' as const, counsellorText: redaction.text.slice(0, 280) }] : [];
      const booking = await api.book({ slotId: d.slotId!, mode: d.mode!, items }, key);
      if (d.replaceBookingId) await api.cancelBooking(d.replaceBookingId).catch(() => undefined);
      draft.clear();
      nav.setStack([
        { name: 'home', params: {} },
        { name: 'booked', params: { id: booking.id } },
      ]);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'slot_unavailable') {
        draft.patch({ slotId: undefined, startsAt: undefined, idempotencyKey: undefined });
        toast(t('slotTaken'));
        nav.back();
      } else toast(t('offline'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card">
        <dl className="kv">
          <dt>{t('counsellor')}</dt>
          <dd>{name}</dd>
          <dt>{t('when')}</dt>
          <dd>{formatSlot(d.startsAt, state.lang, true)}</dd>
          <dt>{t('how')}</dt>
          <dd>{t(MODE_LABEL[d.mode])}</dd>
          <dt>{t('where')}</dt>
          <dd>{d.mode === 'in_person' ? t('roomCampus') : t('roomOnline')}</dd>
        </dl>
      </div>
      <div className="card" style={{ gap: 0 }}>
        <ToggleRow id="discreet" label={t('discreet')} desc={t('discreetD')} checked={state.discreet} onToggle={() => update((s) => ({ discreet: !s.discreet }))} />
      </div>
      <p className="note">
        <Icon.shield />
        {t('noNameNeeded')}
      </p>
      <label htmlFor="bk-note">
        <b>{t('shareLabel')}</b>
      </label>
      <textarea id="bk-note" value={d.note} maxLength={280} onChange={(e) => draft.patch({ note: e.target.value })} />
      {redaction.found.length > 0 && (
        <p className="note" role="status">
          <Icon.info />
          {t('noteWithheld')}
        </p>
      )}
      <button className="btn" disabled={busy} onClick={confirm}>
        {t('confirmBooking')}
      </button>
    </>
  );
}
