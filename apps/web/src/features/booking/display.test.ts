import { describe, expect, it } from 'vitest';
import { campusParts, formatSlot } from '../../app/format';
import { sortedServices } from '../sos/services';
import { initials, slotsByDay } from './display';

describe('booking display', () => {
  it('initials skip honorifics', () => {
    expect(initials('Dr. Tan Mei Ling')).toBe('TM');
    expect(initials('Encik Hafiz Rahman')).toBe('HR');
    expect(initials('Mr. Zhou Yang')).toBe('ZY');
  });

  it('slot times are read in campus time whatever the viewer’s time zone', () => {
    expect(campusParts('2026-12-01T09:00:00+08:00')).toEqual({ day: '2026-12-01', time: '09:00' });
    expect(formatSlot('2026-12-01T09:00:00+08:00', 'en')).toMatch(/09:00$/);
  });

  it('groups slots by campus day in order', () => {
    const s = (id: string, startsAt: string) => ({ id, counsellorId: 'c', startsAt, durationMin: 50 });
    const byDay = slotsByDay([s('a', '2026-12-01T09:00:00+08:00'), s('b', '2026-12-01T14:00:00+08:00'), s('c', '2026-12-02T09:00:00+08:00')]);
    expect([...byDay.keys()]).toEqual(['2026-12-01', '2026-12-02']);
    expect(byDay.get('2026-12-01')!.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('S1 crisis services', () => {
  it('lists open services first; 24-hour lines are always open', () => {
    const night = new Date('2026-11-26T03:00:00');
    const list = sortedServices(night);
    expect(list.filter((s) => s.isOpen).map((s) => s.id)).toEqual(['security', 'bef', '999']);
    expect(list.findIndex((s) => !s.isOpen)).toBeGreaterThan(list.findIndex((s) => s.id === 'bef'));
  });

  it('the counselling centre is open on weekday office hours only', () => {
    const open = (d: string) => sortedServices(new Date(d)).find((s) => s.id === 'counsel')!.isOpen;
    expect(open('2026-11-26T10:00:00')).toBe(true); // Thursday
    expect(open('2026-11-28T10:00:00')).toBe(false); // Saturday
    expect(open('2026-11-26T17:30:00')).toBe(false);
  });
});
