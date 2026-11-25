import { describe, expect, it } from 'vitest';
import { freshState, type Checkin } from '../../app/store';
import { lastSevenDays, lowStreak, saveToday, tagsFor, todayEntry, topThemes } from './logic';

const today = new Date('2026-11-26T10:00:00');
const c = (d: string, mood: number, tags: string[] = [], sample = false): Checkin => ({ d, mood, energy: 3, tags, note: '', sample });

describe('check-in logic', () => {
  it('saving today twice keeps exactly one entry for today (idempotent per day)', () => {
    const once = saveToday([c('2026-11-26', 4, [], true)], { mood: 2, energy: 2, tags: [], note: 'n' }, today);
    const twice = saveToday(once, { mood: 3, energy: 2, tags: [], note: 'n' }, today);
    expect(twice.filter((x) => x.d === '2026-11-26')).toEqual([{ d: '2026-11-26', mood: 3, energy: 2, tags: [], note: 'n', sample: false }]);
  });

  it('todayEntry ignores sample data', () => {
    expect(todayEntry([c('2026-11-26', 3, [], true)], today)).toBeUndefined();
    expect(todayEntry([c('2026-11-26', 3)], today)?.mood).toBe(3);
  });

  it('lowStreak needs three low moods among the last four', () => {
    expect(lowStreak([c('a', 2), c('b', 2), c('c', 4), c('d', 1)])).toBe(true);
    expect(lowStreak([c('a', 2), c('b', 3), c('c', 4), c('d', 1)])).toBe(false);
    expect(lowStreak([])).toBe(false);
  });

  it('lastSevenDays covers 7 consecutive days ending today, with gaps as null', () => {
    const days = lastSevenDays([c('2026-11-25', 2)], today);
    expect(days.map((d) => d.d)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']);
    expect(days[5]!.entry?.mood).toBe(2);
    expect(days[6]!.entry).toBeNull();
  });

  it('topThemes counts tags, most frequent first, at most four', () => {
    const list = [c('a', 3, ['x', 'y']), c('b', 3, ['x']), c('c', 3, ['z', 'w', 'v'])];
    expect(topThemes(list)[0]).toEqual(['x', 2]);
    expect(topThemes(list)).toHaveLength(4);
  });

  it('staff see staff themes', () => {
    expect(tagsFor('staff')).toContain('tTeach');
    expect(tagsFor('student')).toContain('tExams');
  });

  it('fresh state seeds six sample days and nothing else personal', () => {
    const s = freshState(today);
    expect(s.checkins).toHaveLength(6);
    expect(s.checkins.every((x) => x.sample && x.note === '')).toBe(true);
    expect(s.onboarded).toBe(false);
  });
});
