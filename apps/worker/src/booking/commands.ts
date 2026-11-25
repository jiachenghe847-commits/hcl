/**
 * Booking writes: manual booking, cancel, revoke (S5, S6, S7).
 *
 * Every write fails closed:
 * - The booking INSERT is conditional on the slot being neither held nor booked.
 * - Item INSERTs are conditional on that booking existing.
 * - All of these statements run in one D1 batch, which is atomic.
 *
 * The agent-confirm path (next slice) reuses insertBookingStatements.
 */
import type { Booking, ManualBookingRequest, Mode } from '@haven/contracts';
import { findIdentifiers } from '@haven/safety';
import { campusIso } from '../catalog/time.js';
import { ApiError } from '../http/errors.js';
import { getOwnedBooking } from './views.js';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I look-alikes

function newRefCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return 'HV-' + [...bytes].map((b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

export interface NewItem {
  kind: 'shared' | 'generalised';
  counsellorText: string;
}

/** S7: drops (withholds) any item whose text contains a structured identifier. */
export function withholdUnsafeItems<T extends { counsellorText: string }>(items: readonly T[]): T[] {
  return items.filter((i) => findIdentifiers(i.counsellorText).length === 0);
}

export function insertBookingStatements(
  db: D1Database,
  b: {
    id: string;
    refCode: string;
    ownerHash: string;
    slotId: string;
    mode: Mode;
    idempotencyKey: string;
    agentRunId: string | null;
    now: Date;
    /** For the agent-confirm path: the hold this run owns, which is allowed (and required) on the slot. */
    allowedHoldRunId?: string;
  },
  items: readonly NewItem[],
): D1PreparedStatement[] {
  const holdCondition =
    b.allowedHoldRunId === undefined
      ? `NOT EXISTS (SELECT 1 FROM slots WHERE id = ?6 AND hold_expires_at > ?9)`
      : `EXISTS (SELECT 1 FROM slots WHERE id = ?6 AND hold_run_id = ?10 AND hold_expires_at > ?9)`;
  const booking = db
    .prepare(
      `INSERT INTO bookings (id, ref_code, owner_hash, slot_id, mode, status, idempotency_key, agent_run_id, created_at)
       SELECT ?1, ?2, ?3, ?6, ?4, 'confirmed', ?5, ?7, ?8
       WHERE ${holdCondition}
         AND NOT EXISTS (SELECT 1 FROM bookings WHERE slot_id = ?6 AND status = 'confirmed')`,
    )
    .bind(
      b.id,
      b.refCode,
      b.ownerHash,
      b.mode,
      b.idempotencyKey,
      b.slotId,
      b.agentRunId,
      b.now.toISOString(),
      b.now.toISOString(),
      ...(b.allowedHoldRunId === undefined ? [] : [b.allowedHoldRunId]),
    );
  const itemInsert = db.prepare(
    `INSERT INTO disclosure_items (id, booking_id, kind, counsellor_text)
     SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM bookings WHERE id = ?)`,
  );
  return [booking, ...items.map((i) => itemInsert.bind(newId('it'), b.id, i.kind, i.counsellorText, b.id))];
}

async function bookingByKey(db: D1Database, key: string): Promise<{ id: string; owner_hash: string } | null> {
  return db.prepare('SELECT id, owner_hash FROM bookings WHERE idempotency_key = ?').bind(key).first();
}

/** Same key again → same booking. The same key from another device → conflict. */
async function replay(db: D1Database, key: string, ownerHash: string): Promise<Booking | null> {
  const prior = await bookingByKey(db, key);
  if (!prior) return null;
  if (prior.owner_hash !== ownerHash) throw new ApiError('conflict', 'Idempotency-Key already used');
  return getOwnedBooking(db, prior.id, ownerHash);
}

export async function createManualBooking(
  db: D1Database,
  ownerHash: string,
  idempotencyKey: string,
  req: ManualBookingRequest,
  now: Date,
): Promise<{ booking: Booking; replayed: boolean }> {
  const replayed = await replay(db, idempotencyKey, ownerHash);
  if (replayed) return { booking: replayed, replayed: true };

  const slot = await db
    .prepare('SELECT s.id, s.starts_at, c.modes FROM slots s JOIN counsellors c ON c.id = s.counsellor_id WHERE s.id = ?')
    .bind(req.slotId)
    .first<{ id: string; starts_at: string; modes: string }>();
  if (!slot) throw new ApiError('not_found', 'No such slot');
  if (!(JSON.parse(slot.modes) as string[]).includes(req.mode)) {
    throw new ApiError('validation_failed', 'This counsellor does not offer that mode');
  }
  if (slot.starts_at <= campusIso(now)) throw new ApiError('slot_unavailable', 'That time has passed');

  const items = withholdUnsafeItems(req.items);
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newId('bk');
    const statements = insertBookingStatements(
      db,
      { id, refCode: newRefCode(), ownerHash, slotId: slot.id, mode: req.mode, idempotencyKey, agentRunId: null, now },
      items,
    );
    try {
      const [inserted] = await db.batch(statements);
      if (!inserted || inserted.meta.changes === 0) throw new ApiError('slot_unavailable', 'That time was just taken or is on hold');
      const booking = await getOwnedBooking(db, id, ownerHash);
      if (!booking) throw new Error('booking vanished after insert');
      return { booking, replayed: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('bookings.ref_code')) continue; // rare collision: new code, try again
      if (message.includes('bookings.idempotency_key')) {
        const raced = await replay(db, idempotencyKey, ownerHash); // a concurrent duplicate won
        if (raced) return { booking: raced, replayed: true };
      }
      if (message.includes('bookings.slot_id')) throw new ApiError('slot_unavailable', 'That time was just taken');
      throw err;
    }
  }
  throw new ApiError('conflict', 'Could not allocate a reference code; nothing was booked');
}

export async function cancelBooking(db: D1Database, ownerHash: string, id: string, now: Date): Promise<Booking> {
  if (!(await getOwnedBooking(db, id, ownerHash))) throw new ApiError('not_found', 'No such booking');
  await db
    .prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND status = 'confirmed'`)
    .bind(now.toISOString(), id)
    .run();
  return (await getOwnedBooking(db, id, ownerHash))!;
}

export async function revokeItem(db: D1Database, ownerHash: string, bookingId: string, itemId: string, now: Date): Promise<Booking> {
  const booking = await getOwnedBooking(db, bookingId, ownerHash);
  if (!booking || !booking.items.some((i) => i.id === itemId)) throw new ApiError('not_found', 'No such item');
  await db
    .prepare('UPDATE disclosure_items SET revoked_at = ? WHERE id = ? AND booking_id = ? AND revoked_at IS NULL')
    .bind(now.toISOString(), itemId, bookingId)
    .run();
  return (await getOwnedBooking(db, bookingId, ownerHash))!;
}
