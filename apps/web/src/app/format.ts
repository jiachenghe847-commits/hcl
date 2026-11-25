/** Date display helpers. Slot times from the server are '+08:00' strings and are shown in campus time. */
import type { Lang } from './i18n';

const locale = (lang: Lang) => (lang === 'zh' ? 'zh-CN' : 'en-GB');

/** A calendar date (YYYY-MM-DD), e.g. "Wed 2 Dec". */
export function formatDay(isoDay: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(`${isoDay}T12:00:00`).toLocaleDateString(locale(lang), opts);
}

/** Campus date and time parts of a slot's '+08:00' start, independent of the viewer's time zone. */
export function campusParts(startsAt: string): { day: string; time: string } {
  return { day: startsAt.slice(0, 10), time: startsAt.slice(11, 16) };
}

/** "Wed 2 Dec · 14:00" for a slot start. */
export function formatSlot(startsAt: string, lang: Lang, long = false) {
  const { day, time } = campusParts(startsAt);
  return `${formatDay(day, lang, long ? { weekday: 'long', day: 'numeric', month: 'long' } : undefined)} · ${time}`;
}
