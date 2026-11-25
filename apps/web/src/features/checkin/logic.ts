/** Pure check-in rules (unit-tested in logic.test.ts). */
import { addDays, type Checkin, isoDate } from '../../app/store';

export const STUDENT_TAGS = ['tExams', 'tAssign', 'tMoney', 'tSleep', 'tLonely', 'tHome', 'tFamily', 'tHealth'] as const;
export const STAFF_TAGS = ['tTeach', 'tResearch', 'tDeadline', 'tBalance', 'tPromo', 'tSleep', 'tHealth', 'tFamily'] as const;

export const tagsFor = (role: 'student' | 'staff' | null) => (role === 'staff' ? STAFF_TAGS : STUDENT_TAGS);

/** Today's real (non-sample) entry, if any. */
export const todayEntry = (checkins: Checkin[], today = new Date()) =>
  checkins.find((c) => c.d === isoDate(today) && !c.sample);

/** Three or more of the last four check-ins at mood 2 or lower: suggest a counsellor. */
export const lowStreak = (checkins: Checkin[]) => checkins.slice(-4).filter((c) => c.mood <= 2).length >= 3;

/** Saves today's entry, replacing any earlier entry (sample or real) for today. Saving twice keeps one entry. */
export function saveToday(checkins: Checkin[], entry: Omit<Checkin, 'd' | 'sample'>, today = new Date()): Checkin[] {
  const d = isoDate(today);
  return [...checkins.filter((c) => c.d !== d), { ...entry, d, sample: false }];
}

/** The last 7 calendar days, oldest first, with the latest entry for each day or null. */
export function lastSevenDays(checkins: Checkin[], today = new Date()): { d: string; entry: Checkin | null }[] {
  return [...Array(7)].map((_, i) => {
    const d = isoDate(addDays(today, i - 6));
    return { d, entry: [...checkins].reverse().find((c) => c.d === d) ?? null };
  });
}

/** Most frequent themes, top 4. */
export function topThemes(checkins: Checkin[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const c of checkins) for (const k of c.tags) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
}
