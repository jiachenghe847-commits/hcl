import { Counsellor, Slot } from '@haven/contracts';
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { ensureSlots } from '../src/catalog/slots';
import { api } from './client';

describe('catalog', () => {
  it('health needs no auth', async () => {
    expect(await api('/health', { device: null })).toEqual({ status: 200, json: { ok: true } });
  });

  it('rejects requests without a well-formed device token', async () => {
    expect((await api('/counsellors', { device: null })).status).toBe(401);
    expect((await api('/counsellors', { device: 'short' })).json.error.code).toBe('unauthorized');
  });

  it('lists the four fictional counsellors in contract shape', async () => {
    const { status, json } = await api('/counsellors');
    expect(status).toBe(200);
    expect(json.map((c: Counsellor) => Counsellor.parse(c).id)).toEqual(['c-hafiz', 'c-priya', 'c-tan', 'c-zhou']);
  });

  it('generates future weekday slots in campus time (+08:00)', async () => {
    const { json } = await api('/counsellors/c-tan/slots');
    expect(json.length).toBeGreaterThan(5);
    for (const s of json as Slot[]) {
      Slot.parse(s);
      expect(s.startsAt.endsWith('+08:00')).toBe(true);
      const day = new Date(s.startsAt).getUTCDay(); // 09:00–16:00 MYT is the same UTC date
      expect([0, 6]).not.toContain(day);
      expect(new Date(s.startsAt).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('slot generation is idempotent', async () => {
    const now = new Date();
    await ensureSlots(env.DB, now);
    const count = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM slots').first<{ n: number }>())!.n;
    const before = await count();
    await env.DB.prepare('DELETE FROM slots WHERE starts_at >= ?').bind('2099-01-01').run(); // no-op guard
    await ensureSlots(env.DB, now);
    await ensureSlots(env.DB, now);
    expect(await count()).toBe(before);
  });

  it('validates the date range and the counsellor id', async () => {
    expect((await api('/counsellors/c-tan/slots?from=2026-13-01')).status).toBe(400);
    expect((await api('/counsellors/c-tan/slots?from=2026-12-10&to=2026-12-01')).status).toBe(400);
    expect((await api('/counsellors/nobody/slots')).status).toBe(404);
  });

  it('answers unknown endpoints with the error shape', async () => {
    expect(await api('/nope')).toMatchObject({ status: 404, json: { error: { code: 'not_found' } } });
  });
});
