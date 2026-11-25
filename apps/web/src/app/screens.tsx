/**
 * The screen registry. This is the one place that maps a route name to a component plus its chrome:
 * tab bar, title, SOS button. To add a screen, add an entry here and navigate with nav.go('<name>', params).
 */
import type { ReactNode } from 'react';
import { BookList } from '../features/booking/BookList';
import { ConfirmBooking } from '../features/booking/ConfirmBooking';
import { CounsellorDetail } from '../features/booking/CounsellorDetail';
import { Booked, SessionDetail } from '../features/booking/SessionScreens';
import { MoodHistory } from '../features/checkin/MoodHistory';
import { CheckinDone, CheckinEnergy, CheckinMood, CheckinTags } from '../features/checkin/screens';
import { Home } from '../features/home/Home';
import { Me } from '../features/me/Me';
import { Lock, Privacy, Role, SetPin, Welcome } from '../features/onboarding/screens';
import { Alerted, Calling, Sos } from '../features/sos/screens';
import { Breathe } from '../features/wellbeing/Breathe';
import type { StringKey } from './i18n';

export interface ScreenDef {
  render: (params: Record<string, string>) => ReactNode;
  /** Bottom-tab screens show the brand and the tab bar instead of a back button. */
  tab?: boolean;
  /** No top bar at all (welcome, lock). */
  bare?: boolean;
  /** Hide the SOS button (on the SOS screens themselves). */
  noSos?: boolean;
  title?: StringKey | ((params: Record<string, string>) => string);
}

export const TABS = ['home', 'mood', 'book', 'me'] as const;

export const SCREENS: Record<string, ScreenDef> = {
  welcome: { render: () => <Welcome />, bare: true },
  privacy: { render: () => <Privacy /> },
  role: { render: () => <Role /> },
  setpin: { render: () => <SetPin /> },
  lock: { render: () => <Lock />, bare: true },

  home: { render: () => <Home />, tab: true },
  mood: { render: () => <MoodHistory />, tab: true },
  book: { render: () => <BookList />, tab: true },
  me: { render: () => <Me />, tab: true },

  ciMood: { render: () => <CheckinMood />, title: 'howToday' },
  ciEnergy: { render: () => <CheckinEnergy />, title: 'howToday' },
  ciTags: { render: () => <CheckinTags />, title: 'howToday' },
  ciDone: { render: () => <CheckinDone /> },

  counsellor: { render: (p) => <CounsellorDetail id={p.id ?? ''} />, title: (p) => p.name ?? '' },
  confirm: { render: (p) => <ConfirmBooking name={p.name ?? ''} />, title: 'confirmTitle' },
  booked: { render: (p) => <Booked id={p.id ?? ''} /> },
  session: { render: (p) => <SessionDetail id={p.id ?? ''} />, title: 'sessionTitle' },

  sos: { render: () => <Sos />, title: 'sosTitle', noSos: true },
  calling: { render: (p) => <Calling id={p.id ?? ''} />, noSos: true },
  alerted: { render: () => <Alerted />, noSos: true },
  breathe: { render: () => <Breathe />, title: 'breatheTitle' },
};
