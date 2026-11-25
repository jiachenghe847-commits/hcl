/**
 * Slot calendar. Fictional counsellors get generated weekday slots for the next HORIZON_DAYS days.
 * Generation is deterministic and uses INSERT OR IGNORE, so running it twice changes nothing.
 * Slot state is derived (CONTRACTS.md §3): booked if a confirmed booking exists, held if hold_expires_at > now.
 */
import type { Slot } from '@haven/contracts';
import { campusDate, campusIso, isWeekday } from './time.js';

export const HORIZON_DAYS = 14;
const TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

export function slotId(counsellorId: string, date: string, time: string): string {
  return `${counsellorId}-${date.replaceAll('-', '')}-${time.replace(':', '')}`;
}

/** Skips about a third of the hours, so calendars look lived-in. Deterministic per counsellor, date and time. */
function isOffered(counsellorId: string, date: string, time: string): boolean {
  let h = 0;
  for (const ch of counsellorId + date + time) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 3 !== 0;
}

/** Makes sure slots exist from tomorrow up to the horizon. Cheap when they already do. */
export async function ensureSlots(db: D1Database, now: Date): Promise<void> {
  const lastDate = campusDate(now, HORIZON_DAYS);
  const done = await db.prepare('SELECT 1 FROM slots WHERE starts_at >= ? LIMIT 1').bind(`${lastDate}T00:00:00+08:00`).first();
  if (done) return;

  const { results: counsellors } = await db.prepare('SELECT id FROM counsellors').all<{ id: string }>();
  const insert = db.prepare('INSERT OR IGNORE INTO slots (id, counsellor_id, starts_at) VALUES (?, ?, ?)');
  const statements: D1PreparedStatement[] = [];
  for (let day = 1; day <= HORIZON_DAYS; day++) {
    const date = campusDate(now, day);
    if (!isWeekday(date)) continue;
    for (const { id } of counsellors) {
      for (const time of TIMES) {
        if (isOffered(id, date, time)) statements.push(insert.bind(slotId(id, date, time), id, `${date}T${time}:00+08:00`));
      }
    }
  }
  if (statements.length > 0) await db.batch(statements);
}

interface SlotRow {
  id: string;
  counsellor_id: string;
  starts_at: string;
  duration_min: number;
}

const toSlot = (r: SlotRow): Slot => ({ id: r.id, counsellorId: r.counsellor_id, startsAt: r.starts_at, durationMin: r.duration_min });

/** Open = in the future, not held, not booked. `from`/`to` are inclusive campus dates. */
export async function listOpenSlots(
  db: D1Database,
  now: Date,
  q: { counsellorId: string; from: string; to: string; limit?: number },
): Promise<Slot[]> {
  await ensureSlots(db, now);
  const { results } = await db
    .prepare(
      `SELECT s.id, s.counsellor_id, s.starts_at, s.duration_min FROM slots s
       WHERE s.counsellor_id = ? AND s.starts_at >= ? AND s.starts_at <= ? AND s.starts_at > ?
         AND (s.hold_expires_at IS NULL OR s.hold_expires_at <= ?)
         AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed')
       ORDER BY s.starts_at LIMIT ?`,
    )
    .bind(q.counsellorId, `${q.from}T00:00:00+08:00`, `${q.to}T23:59:59+08:00`, campusIso(now), now.toISOString(), q.limit ?? 50)
    .all<SlotRow>();
  return results.map(toSlot);
}
