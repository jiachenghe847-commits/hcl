/**
 * Demo counsellor view (DECISIONS.md D4): what a counsellor sees.
 * Behind a passcode, with no device identity. Revoked items and cancelled bookings never arrive (S4, enforced in SQL).
 */
import type { CounsellorBookingView } from '@haven/contracts';
import { useState } from 'react';
import { api, ApiError } from '../../api/client';
import { formatSlot } from '../../app/format';
import { useStore } from '../../app/store';
import { useAsync } from '../../app/useAsync';
import { MODE_LABEL } from '../booking/display';

export function CounsellorView() {
  const { t, state } = useStore();
  const counsellors = useAsync(() => api.counsellors(), []);
  const [counsellorId, setCounsellorId] = useState('c-zhou');
  const [passcode, setPasscode] = useState('');
  const [list, setList] = useState<CounsellorBookingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setList(await api.counsellorBookings(counsellorId, passcode));
    } catch (e) {
      setList(null);
      setError(t(e instanceof ApiError && e.code === 'unauthorized' ? 'wrongPasscode' : 'offline'));
    }
  };

  return (
    <>
      <p className="lead">{t('counsellorViewLead')}</p>
      <div className="chips">
        {(counsellors.data ?? []).map((c) => (
          <button key={c.id} className="chip" aria-pressed={counsellorId === c.id} onClick={() => setCounsellorId(c.id)}>
            {c.displayName}
          </button>
        ))}
      </div>
      <label htmlFor="cv-pass">
        <b>{t('passcodeLabel')}</b>
      </label>
      <input id="cv-pass" type="password" className="chip" style={{ borderRadius: 12, textAlign: 'left' }} value={passcode} onChange={(e) => setPasscode(e.target.value)} />
      <button className="btn" disabled={!passcode} onClick={load}>
        {t('showBookings')}
      </button>
      {error && (
        <p className="small" role="alert" style={{ color: 'var(--sos)' }}>
          {error}
        </p>
      )}
      {list && list.length === 0 && <p className="small">{t('noBookings')}</p>}
      {list?.map((b) => (
        <div className="card" key={b.refCode}>
          <div className="row">
            <span className="ref" style={{ fontSize: 20 }}>
              {b.refCode}
            </span>
            <div className="spacer" />
            <span className="small">
              {formatSlot(b.slot.startsAt, state.lang)} · {t(MODE_LABEL[b.slot.mode])}
            </span>
          </div>
          {b.items.length === 0 ? (
            <p className="small">{t('sharedNothing')}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {b.items.map((i) => (
                <li key={i.counsellorText}>{i.counsellorText}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}
