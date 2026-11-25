import { describe, expect, it } from 'vitest';
import { freshState } from '../../app/store';
import { type AgentForm, parseNames, prepareAgentRequest } from './prepare';

const form = (p: Partial<AgentForm> = {}): AgentForm => ({ message: '', languages: [], modes: [], availability: '', doNotShare: '', ...p });
const state = () => ({ ...freshState(new Date('2026-11-26T10:00:00')), onboarded: true, role: 'student' as const });

describe('prepareAgentRequest (device side)', () => {
  it('S1: a crisis message never becomes a request', () => {
    expect(prepareAgentRequest(state(), form({ message: '我不想活了' }))).toEqual({ kind: 'crisis' });
    expect(prepareAgentRequest(state(), form({ availability: 'whenever, I want to die' }))).toEqual({ kind: 'crisis' });
  });

  it('S3: removes identifiers and the user’s own do-not-share names before sending', () => {
    const p = prepareAgentRequest(state(), form({ message: 'Li Na and 李娜 shout; call 012-345 6789', doNotShare: 'Li Na，李娜' }));
    if (p.kind !== 'request') throw new Error('expected request');
    expect(p.request.message).toBe('[name] and [name] shout; call [phone]');
    expect(JSON.stringify(p.request)).not.toMatch(/Li Na|李娜|6789/);
    expect(p.redactedKinds).toEqual(['name', 'phone']);
  });

  it('never sends private notes; check-ins go as mood, energy and tags only', () => {
    const s = state();
    s.checkins.push({ d: '2026-11-26', mood: 2, energy: 2, tags: ['tExams'], note: 'my secret', sample: false });
    const p = prepareAgentRequest(s, form());
    if (p.kind !== 'request') throw new Error('expected request');
    expect(JSON.stringify(p.request)).not.toContain('secret');
    expect(Object.keys(p.request.checkins[0]!)).toEqual(['date', 'mood', 'energy', 'tags']);
    expect(p.request.message).toBeUndefined();
  });

  it('parses names separated by commas (EN/ZH) and ignores one-letter entries', () => {
    expect(parseNames('Li Na, 李娜，王伟、A')).toEqual(['Li Na', '李娜', '王伟']);
  });
});
