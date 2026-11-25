/** Booking bodies for the owner (student or staff) and for the counsellor view (CONTRACTS.md §4, S4). */
import { z } from 'zod';
import { Id, IsoDateTime, Mode } from './common.js';

export const ItemKind = z.enum(['shared', 'generalised']);

export const ManualBookingRequest = z.strictObject({
  slotId: Id,
  mode: Mode,
  items: z.array(z.strictObject({ kind: ItemKind, counsellorText: z.string().min(1).max(280) })).max(8),
});

export const Booking = z.strictObject({
  id: Id,
  refCode: z.string().regex(/^HV-[A-Z0-9]{4}$/),
  status: z.enum(['confirmed', 'cancelled']),
  counsellor: z.strictObject({ id: Id, displayName: z.string() }),
  slot: z.strictObject({ id: Id, startsAt: IsoDateTime, mode: Mode }),
  items: z.array(
    z.strictObject({ id: Id, kind: ItemKind, counsellorText: z.string(), revokedAt: IsoDateTime.nullable() }),
  ),
  createdAt: IsoDateTime,
});

/** What a counsellor sees: no booking id, no owner, and no revoked items (S4). */
export const CounsellorBookingView = z.strictObject({
  refCode: Booking.shape.refCode,
  slot: z.strictObject({ startsAt: IsoDateTime, mode: Mode }),
  items: z.array(z.strictObject({ kind: ItemKind, counsellorText: z.string() })),
});

export type ItemKind = z.infer<typeof ItemKind>;
export type ManualBookingRequest = z.infer<typeof ManualBookingRequest>;
export type Booking = z.infer<typeof Booking>;
export type CounsellorBookingView = z.infer<typeof CounsellorBookingView>;
