/** Test client: calls the real worker (SELF) as a given device. */
import type { Booking, Slot } from '@haven/contracts';
import { SELF } from 'cloudflare:test';

export const DEVICE_A = 'a'.repeat(43);
export const DEVICE_B = 'b'.repeat(43);
export const PASSCODE = 'test-passcode';

/** Storage is shared by the tests in one file, so tests that count rows use their own device. */
export const newDevice = () => (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '').slice(0, 48);

export async function api(
  path: string,
  opts: { method?: string; body?: unknown; device?: string | null; headers?: Record<string, string> } = {},
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...opts.headers };
  const device = opts.device === undefined ? DEVICE_A : opts.device;
  if (device) headers['X-Haven-Device'] = device;
  const res = await SELF.fetch(`https://haven.test/api${path}`, {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  return { status: res.status, json: await res.json() };
}

export async function firstOpenSlot(counsellorId = 'c-zhou', index = 0): Promise<Slot> {
  const { json } = await api(`/counsellors/${counsellorId}/slots`);
  const slot = (json as Slot[])[index];
  if (!slot) throw new Error('no open slot in fixture');
  return slot;
}

let keySeq = 0;
export const freshKey = () => `test-key-${++keySeq}-${crypto.randomUUID()}`;

export async function book(
  slotId: string,
  opts: { device?: string; key?: string; items?: { kind: 'shared' | 'generalised'; counsellorText: string }[]; mode?: string } = {},
): Promise<{ status: number; json: Booking & { error?: { code: string } } }> {
  return api('/bookings', {
    method: 'POST',
    device: opts.device ?? DEVICE_A,
    headers: { 'Idempotency-Key': opts.key ?? freshKey() },
    body: { slotId, mode: opts.mode ?? 'video', items: opts.items ?? [] },
  });
}
