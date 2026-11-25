/** The dev/demo scripted provider drives the real loop, tools and server checks to a valid proposal. */
import { Proposal } from '@haven/contracts';
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createRun } from '../src/agent/service';
import { ScriptedProvider } from '../src/llm/scripted';
import { api, freshKey } from './client';

const run = (message: string, extra: object = {}) =>
  createRun({
    db: env.DB,
    provider: new ScriptedProvider(),
    ownerHash: `owner_${crypto.randomUUID()}`,
    idempotencyKey: freshKey(),
    request: {
      locale: 'en',
      role: 'student',
      checkins: [
        { date: '2026-11-24', mood: 2, energy: 2, tags: ['tExams'] },
        { date: '2026-11-25', mood: 2, energy: 3, tags: ['tExams', 'tSleep'] },
      ],
      message,
      ...extra,
    },
    now: new Date(),
  });

describe('ScriptedProvider', () => {
  it('reaches a valid proposal with a held slot through the real tools', async () => {
    const { run: r } = await run('Exams are crushing me. My roommate keeps shouting. I cannot pay rent.');
    expect(r.status).toBe('proposed');
    const p = Proposal.parse(r.proposal);
    expect(p.disclosure.map((d) => d.choice)).toEqual(['generalise', 'generalise', 'withhold']);
    expect(p.disclosure[1]!.counsellorText).toBe('Ongoing difficulty in a close relationship');
    expect(JSON.stringify(p.disclosure.map((d) => d.counsellorText))).not.toMatch(/roommate|rent/i);
  });

  it('honours language and mode preferences', async () => {
    const { run: r } = await run('考试压力很大', { locale: 'zh', preferences: { languages: ['zh'], modes: ['chat'] } });
    expect(r.proposal!.counsellor.id).toBe('c-zhou'); // the only Chinese speaker offering chat
    expect(r.proposal!.slot.mode).toBe('chat');
    expect(r.proposal!.summary).toMatch(/次记录/);
  });

  it('withholds sentences that still contain identifier placeholders', async () => {
    const { run: r } = await run('Call me on 012-345 6789. I feel anxious all the time.');
    expect(r.proposal!.disclosure[0]).toMatchObject({ choice: 'withhold', counsellorText: null });
    expect(r.proposal!.disclosure[1]).toMatchObject({ choice: 'generalise', counsellorText: 'Feeling anxious' });
  });

  it('shares only the check-in theme when there is no message', async () => {
    const { run: r } = await run('');
    expect(r.proposal!.disclosure).toEqual([expect.objectContaining({ choice: 'share', counsellorText: 'Stress related to studies and exams' })]);
  });

  it('the crisis gate still runs first', async () => {
    expect((await run('I want to kill myself')).run.status).toBe('crisis');
  });

  it('health reports the agent mode (none here: no LLM configured in tests)', async () => {
    expect((await api('/health', { device: null })).json).toEqual({ ok: true, agentMode: 'none' });
  });
});
