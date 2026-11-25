import { Booking } from '@haven/contracts';
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { api, book, DEVICE_B, firstOpenSlot, freshKey, newDevice } from './client';

describe('manual booking (S5)', () => {
  it('books an open slot and returns the contract shape', async () => {
    const slot = await firstOpenSlot();
    const { status, json } = await book(slot.id, { items: [{ kind: 'generalised', counsellorText: 'Stress about exams' }] });
    expect(status).toBe(201);
    const b = Booking.parse(json);
    expect(b.status).toBe('confirmed');
    expect(b.refCode).toMatch(/^HV-[A-Z0-9]{4}$/);
    expect(b.items).toHaveLength(1);
    // The booked slot is no longer offered.
    const open = await api(`/counsellors/c-zhou/slots`);
    expect(open.json.map((s: { id: string }) => s.id)).not.toContain(slot.id);
  });

  it('same Idempotency-Key twice → the same booking, no second row', async () => {
    const slot = await firstOpenSlot();
    const key = freshKey();
    const first = await book(slot.id, { key });
    const second = await book(slot.id, { key });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.json.id).toBe(first.json.id);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings WHERE slot_id = ?').bind(slot.id).first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it('the same key from another device is a conflict, not a leak', async () => {
    const slot = await firstOpenSlot();
    const key = freshKey();
    await book(slot.id, { key });
    const other = await book(slot.id, { key, device: DEVICE_B });
    expect(other.status).toBe(409);
    expect(other.json.error?.code).toBe('conflict');
  });

  it('refuses a slot that is already booked', async () => {
    const slot = await firstOpenSlot();
    await book(slot.id);
    const again = await book(slot.id, { device: DEVICE_B });
    expect(again.status).toBe(409);
    expect(again.json.error?.code).toBe('slot_unavailable');
  });

  it('refuses a slot that an agent run is holding (fail closed)', async () => {
    const slot = await firstOpenSlot();
    const later = new Date(Date.now() + 5 * 60_000).toISOString();
    await env.DB.prepare('UPDATE slots SET hold_run_id = ?, hold_expires_at = ? WHERE id = ?').bind('run_x', later, slot.id).run();
    const r = await book(slot.id);
    expect(r.json.error?.code).toBe('slot_unavailable');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings WHERE slot_id = ?').bind(slot.id).first<{ n: number }>();
    expect(n!.n).toBe(0);
  });

  it('allows a slot whose hold has expired', async () => {
    const slot = await firstOpenSlot();
    const past = new Date(Date.now() - 60_000).toISOString();
    await env.DB.prepare('UPDATE slots SET hold_run_id = ?, hold_expires_at = ? WHERE id = ?').bind('run_x', past, slot.id).run();
    expect((await book(slot.id)).status).toBe(201);
  });

  it('rejects a mode the counsellor does not offer, a missing key and a bad body', async () => {
    const slot = await firstOpenSlot();
    expect((await book(slot.id, { mode: 'in_person' })).status).toBe(400); // Mr. Zhou: video/chat only
    const noKey = await api('/bookings', { method: 'POST', body: { slotId: slot.id, mode: 'video', items: [] } });
    expect(noKey.json.error.code).toBe('validation_failed');
    const extra = await api('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': freshKey() },
      body: { slotId: slot.id, mode: 'video', items: [], note: 'raw' },
    });
    expect(extra.status).toBe(400);
  });

  it('S7: withholds items that contain identifiers', async () => {
    const slot = await firstOpenSlot();
    const r = await book(slot.id, {
      items: [
        { kind: 'shared', counsellorText: 'Call me on 012-345 6789' },
        { kind: 'generalised', counsellorText: 'Conflict with a housemate' },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.json.items.map((i) => i.counsellorText)).toEqual(['Conflict with a housemate']);
  });
});

describe('owner scoping, cancel and revoke (S6)', () => {
  it('lists only this device’s bookings', async () => {
    const [mine, other] = [newDevice(), newDevice()];
    const { json: b } = await book((await firstOpenSlot()).id, { device: mine });
    expect((await api('/bookings', { device: mine })).json.map((x: { id: string }) => x.id)).toEqual([b.id]);
    expect((await api('/bookings', { device: other })).json).toHaveLength(0);
  });

  it('cancel twice is a no-op the second time, and frees the slot', async () => {
    const slot = await firstOpenSlot();
    const { json: b } = await book(slot.id);
    const first = await api(`/bookings/${b.id}/cancel`, { method: 'POST' });
    const second = await api(`/bookings/${b.id}/cancel`, { method: 'POST' });
    expect(first.json.status).toBe('cancelled');
    expect(second.json).toEqual(first.json); // cancelled_at unchanged
    expect((await book(slot.id, { device: DEVICE_B })).status).toBe(201);
  });

  it('another device cannot see, cancel or revoke a booking', async () => {
    const { json: b } = await book((await firstOpenSlot()).id, { items: [{ kind: 'shared', counsellorText: 'Exam stress' }] });
    expect((await api(`/bookings/${b.id}/cancel`, { method: 'POST', device: DEVICE_B })).status).toBe(404);
    const item = b.items[0]!;
    expect((await api(`/bookings/${b.id}/items/${item.id}/revoke`, { method: 'POST', device: DEVICE_B })).status).toBe(404);
    const mine = (await api('/bookings')).json.find((x: { id: string }) => x.id === b.id);
    expect(mine.status).toBe('confirmed');
  });

  it('revoke twice keeps the first revocation time', async () => {
    const { json: b } = await book((await firstOpenSlot()).id, { items: [{ kind: 'shared', counsellorText: 'Exam stress' }] });
    const item = b.items[0]!;
    const first = await api(`/bookings/${b.id}/items/${item.id}/revoke`, { method: 'POST' });
    const second = await api(`/bookings/${b.id}/items/${item.id}/revoke`, { method: 'POST' });
    expect(first.json.items[0].revokedAt).not.toBeNull();
    expect(second.json.items[0].revokedAt).toBe(first.json.items[0].revokedAt);
    expect((await api(`/bookings/${b.id}/items/nope/revoke`, { method: 'POST' })).status).toBe(404);
  });
});
