import { CounsellorBookingView } from '@haven/contracts';
import { describe, expect, it } from 'vitest';
import { api, book, firstOpenSlot, PASSCODE } from './client';

const asCounsellor = (counsellorId: string, passcode: string | null = PASSCODE) =>
  api(`/counsellor/${counsellorId}/bookings`, { device: null, headers: passcode ? { 'X-Haven-Demo-Passcode': passcode } : {} });

describe('counsellor view (S4)', () => {
  it('requires the demo passcode', async () => {
    expect((await asCounsellor('c-zhou', null)).status).toBe(401);
    expect((await asCounsellor('c-zhou', 'wrong')).status).toBe(401);
    expect((await asCounsellor('c-zhou')).status).toBe(200);
    expect((await asCounsellor('nobody')).status).toBe(404);
  });

  it('shows only confirmed bookings and non-revoked items, with no booking id or owner', async () => {
    const kept = await book((await firstOpenSlot('c-zhou', 0)).id, {
      items: [
        { kind: 'generalised', counsellorText: 'Exam stress' },
        { kind: 'generalised', counsellorText: 'Conflict with a housemate' },
      ],
    });
    const cancelled = await book((await firstOpenSlot('c-zhou', 1)).id, { items: [{ kind: 'shared', counsellorText: 'Gone' }] });
    await api(`/bookings/${cancelled.json.id}/cancel`, { method: 'POST' });
    await api(`/bookings/${kept.json.id}/items/${kept.json.items[1]!.id}/revoke`, { method: 'POST' });

    const { json } = await asCounsellor('c-zhou');
    expect(json).toHaveLength(1);
    const view = CounsellorBookingView.parse(json[0]); // strict: would fail on id, ownerHash or revokedAt
    expect(view.refCode).toBe(kept.json.refCode);
    expect(view.items).toEqual([{ kind: 'generalised', counsellorText: 'Exam stress' }]);
    expect(JSON.stringify(json)).not.toContain(kept.json.id);
  });

  it('does not show another counsellor’s bookings', async () => {
    await book((await firstOpenSlot('c-zhou')).id);
    expect((await asCounsellor('c-tan')).json).toEqual([]);
  });
});
