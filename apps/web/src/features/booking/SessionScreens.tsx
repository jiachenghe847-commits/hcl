/** After booking: confirmation, session details (reschedule, cancel, stop sharing an item). */
import type { Booking } from '@haven/contracts';
import { useState } from 'react';
import { api } from '../../api/client';
import { useFeedback } from '../../app/feedback';
import { formatSlot } from '../../app/format';
import { Icon } from '../../app/icons';
import { LoadState } from '../../app/LoadState';
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { useAsync } from '../../app/useAsync';
import { initials, MODE_LABEL } from './display';
import { useBookingDraft } from './state';

function useBooking(id: string) {
  return useAsync(async () => {
    const b = (await api.bookings()).find((x) => x.id === id);
    if (!b) throw new Error('not found');
    return b;
  }, [id]);
}

export function Booked({ id }: { id: string }) {
  const { t, state } = useStore();
  const nav = useNav();
  return (
    <LoadState load={useBooking(id)}>
      {(b) => (
        <>
          <div style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 10, paddingTop: 8 }}>
            <Icon.check width={72} height={72} />
            <h2>{t('bookedTitle')}</h2>
            <p className="lead">{t('bookedLead')}</p>
          </div>
          <div className="card">
            <dl className="kv">
              <dt>{t('counsellor')}</dt>
              <dd>{b.counsellor.displayName}</dd>
              <dt>{t('when')}</dt>
              <dd>{formatSlot(b.slot.startsAt, state.lang)}</dd>
              <dt>{t('how')}</dt>
              <dd>{t(MODE_LABEL[b.slot.mode])}</dd>
            </dl>
          </div>
          <div className="card soft" style={{ textAlign: 'center' }}>
            <span className="eyebrow">{t('yourRef')}</span>
            <div className="ref">{b.refCode}</div>
            <p className="small" style={{ color: 'var(--ink)' }}>
              {t('refHelp')}
            </p>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => nav.go('home', {}, { root: true })}>
            {t('done')}
          </button>
        </>
      )}
    </LoadState>
  );
}

export function SessionDetail({ id }: { id: string }) {
  const { t, state } = useStore();
  const nav = useNav();
  const { toast, sheet } = useFeedback();
  const draft = useBookingDraft();
  const load = useBooking(id);
  const [override, setOverride] = useState<Booking | null>(null);

  const cancel = (b: Booking) =>
    sheet({
      title: t('cancelQ'),
      body: t('cancelD'),
      actions: [
        {
          label: t('yesCancel'),
          cls: 'danger',
          run: () =>
            api.cancelBooking(b.id).then(
              () => {
                nav.go('me', {}, { root: true });
                toast(t('cancelled'));
              },
              () => toast(t('offline')),
            ),
        },
        { label: t('noKeep'), cls: 'quiet' },
      ],
    });

  return (
    <LoadState load={load}>
      {(loaded) => {
        const b = override ?? loaded;
        return (
          <>
            <div className="row">
              <div className="avatar">{initials(b.counsellor.displayName)}</div>
              <div>
                <h3>{b.counsellor.displayName}</h3>
              </div>
            </div>
            <div className="card">
              <dl className="kv">
                <dt>{t('when')}</dt>
                <dd>{formatSlot(b.slot.startsAt, state.lang, true)}</dd>
                <dt>{t('how')}</dt>
                <dd>{t(MODE_LABEL[b.slot.mode])}</dd>
                <dt>{t('where')}</dt>
                <dd>{b.slot.mode === 'in_person' ? t('roomCampus') : t('roomOnline')}</dd>
                <dt>{t('yourRef')}</dt>
                <dd>{b.refCode}</dd>
              </dl>
            </div>
            <div className="card">
              <b>{t('sharedWith')}</b>
              {b.items.length === 0 && <p className="small">{t('sharedNothing')}</p>}
              {b.items.map((i) => (
                <div className="row" key={i.id}>
                  <p style={{ flex: 1, textDecoration: i.revokedAt ? 'line-through' : 'none', color: i.revokedAt ? 'var(--muted)' : 'inherit' }}>{i.counsellorText}</p>
                  {i.revokedAt ? (
                    <span className="small">{t('revoked')}</span>
                  ) : (
                    <button
                      className="btn quiet"
                      style={{ width: 'auto' }}
                      onClick={() =>
                        api.revokeItem(b.id, i.id).then(
                          (next) => {
                            setOverride(next);
                            toast(t('stoppedSharing'));
                          },
                          () => toast(t('offline')),
                        )
                      }
                    >
                      {t('stopSharing')}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                draft.replace({ counsellorId: b.counsellor.id, mode: b.slot.mode, note: '', replaceBookingId: b.id });
                nav.go('counsellor', { id: b.counsellor.id, name: b.counsellor.displayName });
              }}
            >
              {t('changeTime')}
            </button>
            <button className="btn quiet" style={{ color: 'var(--sos)' }} onClick={() => cancel(b)}>
              {t('cancelSession')}
            </button>
          </>
        );
      }}
    </LoadState>
  );
}
