/**
 * Read models for bookings.
 * The owner sees the full Booking. The counsellor sees CounsellorBookingView, and the S4 filter
 * (confirmed bookings only, non-revoked items only) lives in this SQL, not in callers.
 */
import type { Booking, CounsellorBookingView } from '@haven/contracts';

interface BookingRow {
  id: string;
  ref_code: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  slot_id: string;
  starts_at: string;
  mode: Booking['slot']['mode'];
  counsellor_id: string;
  display_name: string;
}

interface ItemRow {
  id: string;
  booking_id: string;
  kind: 'shared' | 'generalised';
  counsellor_text: string;
  revoked_at: string | null;
}

const BOOKING_SELECT = `SELECT b.id, b.ref_code, b.status, b.created_at, b.mode, s.id AS slot_id, s.starts_at,
  c.id AS counsellor_id, c.display_name
  FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN counsellors c ON c.id = s.counsellor_id`;

async function withItems(db: D1Database, rows: BookingRow[]): Promise<Booking[]> {
  if (rows.length === 0) return [];
  const placeholders = rows.map(() => '?').join(',');
  const { results: items } = await db
    .prepare(`SELECT * FROM disclosure_items WHERE booking_id IN (${placeholders}) ORDER BY rowid`)
    .bind(...rows.map((r) => r.id))
    .all<ItemRow>();
  return rows.map((r) => ({
    id: r.id,
    refCode: r.ref_code,
    status: r.status,
    counsellor: { id: r.counsellor_id, displayName: r.display_name },
    slot: { id: r.slot_id, startsAt: r.starts_at, mode: r.mode },
    items: items
      .filter((i) => i.booking_id === r.id)
      .map((i) => ({ id: i.id, kind: i.kind, counsellorText: i.counsellor_text, revokedAt: i.revoked_at })),
    createdAt: r.created_at,
  }));
}

/** The booking if it exists AND belongs to this owner; otherwise null (callers answer not_found, never "forbidden"). */
export async function getOwnedBooking(db: D1Database, id: string, ownerHash: string): Promise<Booking | null> {
  const row = await db.prepare(`${BOOKING_SELECT} WHERE b.id = ? AND b.owner_hash = ?`).bind(id, ownerHash).first<BookingRow>();
  return row ? ((await withItems(db, [row]))[0] ?? null) : null;
}

export async function listOwnedBookings(db: D1Database, ownerHash: string): Promise<Booking[]> {
  const { results } = await db
    .prepare(`${BOOKING_SELECT} WHERE b.owner_hash = ? ORDER BY b.created_at DESC LIMIT 50`)
    .bind(ownerHash)
    .all<BookingRow>();
  return withItems(db, results);
}

/** S4: confirmed bookings only, non-revoked items only, no booking id or owner in the output. */
export async function listCounsellorBookings(db: D1Database, counsellorId: string): Promise<CounsellorBookingView[]> {
  const { results: rows } = await db
    .prepare(
      `SELECT b.id, b.ref_code, b.mode, s.starts_at FROM bookings b JOIN slots s ON s.id = b.slot_id
       WHERE s.counsellor_id = ? AND b.status = 'confirmed' ORDER BY s.starts_at`,
    )
    .bind(counsellorId)
    .all<{ id: string; ref_code: string; mode: Booking['slot']['mode']; starts_at: string }>();
  const { results: items } = await db
    .prepare(
      `SELECT i.booking_id, i.kind, i.counsellor_text FROM disclosure_items i
       JOIN bookings b ON b.id = i.booking_id JOIN slots s ON s.id = b.slot_id
       WHERE s.counsellor_id = ? AND b.status = 'confirmed' AND i.revoked_at IS NULL ORDER BY i.rowid`,
    )
    .bind(counsellorId)
    .all<Pick<ItemRow, 'booking_id' | 'kind' | 'counsellor_text'>>();
  return rows.map((r) => ({
    refCode: r.ref_code,
    slot: { startsAt: r.starts_at, mode: r.mode },
    items: items.filter((i) => i.booking_id === r.id).map((i) => ({ kind: i.kind, counsellorText: i.counsellor_text })),
  }));
}
