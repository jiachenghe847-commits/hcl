/**
 * Campus time (Asia/Kuala_Lumpur, UTC+8, no daylight saving).
 * Slot times are stored as '+08:00' strings, so they compare correctly as text.
 * Hold expiry times are stored as UTC 'Z' strings and compared with now.toISOString().
 */
const OFFSET_MS = 8 * 3600_000;

/** MYT calendar date (YYYY-MM-DD) of an instant, shifted by whole days. */
export function campusDate(now: Date, addDays = 0): string {
  return new Date(now.getTime() + OFFSET_MS + addDays * 86_400_000).toISOString().slice(0, 10);
}

/** The instant as a '+08:00' ISO string, comparable with slots.starts_at. */
export function campusIso(now: Date): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 19) + '+08:00';
}

export function isWeekday(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}
