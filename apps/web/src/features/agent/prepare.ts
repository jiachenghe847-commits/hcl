/**
 * Builds the agent request on the device (S1, S3):
 * - Crisis check first, offline. A crisis goes straight to SOS and nothing is sent.
 * - The message is redacted with the user's own do-not-share names, which never leave the phone.
 * - Check-ins are sent as mood/energy/tags only. Private notes are never sent.
 */
import type { AgentRunRequest, Language, Mode } from '@haven/contracts';
import { detectCrisis, redactIdentifiers } from '@haven/safety';
import type { AppState } from '../../app/store';

export interface AgentForm {
  message: string;
  languages: Language[];
  modes: Mode[];
  availability: string;
  doNotShare: string;
}

export type Prepared = { kind: 'crisis' } | { kind: 'request'; request: AgentRunRequest; redactedKinds: string[] };

export const parseNames = (s: string) =>
  s
    .split(/[,，、\n]/)
    .map((n) => n.trim())
    .filter((n) => n.length >= 2);

export function prepareAgentRequest(state: AppState, form: AgentForm): Prepared {
  // Sample check-ins are included on purpose: in the demo they stand in for a real week of entries.
  const real = state.checkins.slice(-14);
  const latestMood = real.at(-1)?.mood;
  const crisis = detectCrisis({ text: `${form.message}\n${form.availability}`, ...(latestMood ? { latestMood } : {}) });
  if (crisis.level === 'crisis') return { kind: 'crisis' };

  const names = parseNames(form.doNotShare);
  const message = redactIdentifiers(form.message.trim(), { doNotShare: names });
  const availability = redactIdentifiers(form.availability.trim(), { doNotShare: names }).text;
  const request: AgentRunRequest = {
    locale: state.lang,
    role: state.role ?? 'student',
    checkins: real.map((c) => ({ date: c.d, mood: c.mood, energy: c.energy, tags: c.tags.slice(0, 10) })),
    ...(message.text ? { message: message.text.slice(0, 1000) } : {}),
    preferences: {
      ...(form.languages.length ? { languages: form.languages } : {}),
      ...(form.modes.length ? { modes: form.modes } : {}),
      ...(availability ? { availability: availability.slice(0, 200) } : {}),
    },
  };
  return { kind: 'request', request, redactedKinds: message.found };
}
