/**
 * Crisis services (S1: static, works offline, no LLM, no network).
 * Numbers are public helplines; "Campus" entries are demo placeholders until the university provides real ones.
 */
import type { StringKey } from '../../app/i18n';

export interface Service {
  id: string;
  name: StringKey;
  hours: StringKey;
  number: string | null;
  open: (now: Date) => boolean;
}

const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

export const SERVICES: Service[] = [
  { id: 'security', name: 'svcSecurity', hours: 'h24', number: null, open: () => true },
  { id: 'bef', name: 'svcBef', hours: 'svcBefH', number: '03-7627 2929', open: () => true },
  { id: 'heal', name: 'svcHeal', hours: 'svcHealH', number: '15555', open: (d) => minutes(d) >= 480 },
  {
    id: 'counsel',
    name: 'svcCounsel',
    hours: 'svcCounselH',
    number: null,
    open: (d) => d.getDay() >= 1 && d.getDay() <= 5 && minutes(d) >= 540 && minutes(d) < 1020,
  },
  { id: '999', name: 'svc999', hours: 'svc999H', number: '999', open: () => true },
];

/** Open services first, original order otherwise. */
export const sortedServices = (now: Date) =>
  SERVICES.map((s, i) => ({ s, i, open: s.open(now) }))
    .sort((a, b) => Number(b.open) - Number(a.open) || a.i - b.i)
    .map(({ s, open }) => ({ ...s, isOpen: open }));
