/**
 * Typed access to the worker API (docs/CONTRACTS.md §4).
 * - The anonymous device token is created once and kept in localStorage. The server only stores its hash.
 * - Every creating POST carries an Idempotency-Key, so a double tap returns the same result.
 * - Responses are validated with the shared contract schemas.
 */
import { Booking, Counsellor, ErrorBody, type ErrorCode, type ManualBookingRequest, Slot } from '@haven/contracts';
import { z } from 'zod';

const DEVICE_KEY = 'haven-device';

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deviceToken(): string {
  let token = localStorage.getItem(DEVICE_KEY);
  if (!token) {
    token = base64url(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(DEVICE_KEY, token);
  }
  return token;
}

/** A new anonymous identity, e.g. when resetting the prototype between test participants. */
export function forgetDevice(): void {
  localStorage.removeItem(DEVICE_KEY);
}

export const newIdempotencyKey = () => crypto.randomUUID();

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'network',
    message: string,
  ) {
    super(message);
  }
}

async function request<S extends z.ZodType>(
  schema: S,
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<z.infer<S>> {
  const headers: Record<string, string> = { 'X-Haven-Device': deviceToken() };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    throw new ApiError('network', 'offline');
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = ErrorBody.safeParse(json);
    throw err.success ? new ApiError(err.data.error.code, err.data.error.message) : new ApiError('internal', `HTTP ${res.status}`);
  }
  return schema.parse(json);
}

export const api = {
  counsellors: () => request(z.array(Counsellor), '/counsellors'),
  openSlots: (counsellorId: string) => request(z.array(Slot), `/counsellors/${encodeURIComponent(counsellorId)}/slots`),
  bookings: () => request(z.array(Booking), '/bookings'),
  book: (body: ManualBookingRequest, idempotencyKey: string) => request(Booking, '/bookings', { method: 'POST', body, idempotencyKey }),
  cancelBooking: (id: string) => request(Booking, `/bookings/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  revokeItem: (bookingId: string, itemId: string) =>
    request(Booking, `/bookings/${encodeURIComponent(bookingId)}/items/${encodeURIComponent(itemId)}/revoke`, { method: 'POST' }),
};
