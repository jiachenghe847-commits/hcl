/** How counsellor data from the API is shown: initials, translated labels, Chinese bios for the fictional counsellors. */
import type { Counsellor, FocusArea, Mode, Slot } from '@haven/contracts';
import type { Lang, StringKey } from '../../app/i18n';
import { campusParts } from '../../app/format';

const HONORIFICS = new Set(['dr.', 'mr.', 'ms.', 'mrs.', 'encik', 'puan', 'prof.']);

/** "Dr. Tan Mei Ling" → "TM"; "Encik Hafiz Rahman" → "HR". */
export function initials(displayName: string): string {
  const words = displayName.split(/\s+/).filter((w) => !HONORIFICS.has(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export const FOCUS_LABEL: Record<FocusArea, StringKey> = {
  academic_stress: 'fAcademic',
  anxiety: 'fAnxiety',
  low_mood: 'fLowMood',
  loneliness: 'fLoneliness',
  homesickness: 'fHomesick',
  relationships: 'fRelationships',
  financial_stress: 'fMoney',
  sleep: 'fSleep',
  work_stress: 'fWork',
  burnout: 'fBurnout',
};

export const MODE_LABEL: Record<Mode, StringKey> = { in_person: 'inPerson', video: 'video', chat: 'chat' };

export const LANGUAGE_LABEL: Record<string, [string, string]> = {
  en: ['English', '英语'],
  zh: ['中文', '中文'],
  ms: ['Bahasa Melayu', '马来语'],
};
export const languageLabel = (code: string, lang: Lang) => LANGUAGE_LABEL[code]?.[lang === 'zh' ? 1 : 0] ?? code;

/** Display-only Chinese bios for the fictional seed counsellors; other counsellors fall back to the API's English bio. */
const BIO_ZH: Record<string, string> = {
  'c-tan': '临床咨询师，主要帮助面临考试压力和焦虑的学生。',
  'c-hafiz': '注册咨询师，采用务实的、以解决问题为导向的方法。',
  'c-priya': '同时接待学生和教职员工。教职员工咨询在单独的房间进行。',
  'c-zhou': '帮助国际学生适应校园生活。',
};
export const bio = (c: Counsellor, lang: Lang) => (lang === 'zh' ? (BIO_ZH[c.id] ?? c.bio) : c.bio);

/** Open slots grouped by campus date, in order. */
export function slotsByDay(slots: Slot[]): Map<string, Slot[]> {
  const byDay = new Map<string, Slot[]>();
  for (const s of slots) {
    const { day } = campusParts(s.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  return byDay;
}

export const SESSION_TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
