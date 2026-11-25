import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AgentRunRequest,
  ConfirmRequest,
  CounsellorBookingView,
  DisclosureItem,
  HoldSlotInput,
  Proposal,
  StoredProposal,
  SubmitProposalInput,
} from './index.js';

const checkin = { date: '2026-11-24', mood: 2, energy: 3, tags: ['tExams'] };

describe('AgentRunRequest (S3 at the boundary)', () => {
  it('accepts a minimal request', () => {
    expect(AgentRunRequest.safeParse({ locale: 'en', role: 'student', checkins: [] }).success).toBe(true);
  });

  it('rejects a check-in that still carries a private note', () => {
    const r = AgentRunRequest.safeParse({ locale: 'en', role: 'student', checkins: [{ ...checkin, note: 'secret' }] });
    expect(r.success).toBe(false);
  });

  it('rejects more than 14 check-ins, a too-long message and out-of-range ratings', () => {
    const base = { locale: 'zh', role: 'staff' };
    expect(AgentRunRequest.safeParse({ ...base, checkins: Array(15).fill(checkin) }).success).toBe(false);
    expect(AgentRunRequest.safeParse({ ...base, checkins: [], message: 'x'.repeat(1001) }).success).toBe(false);
    expect(AgentRunRequest.safeParse({ ...base, checkins: [{ ...checkin, mood: 6 }] }).success).toBe(false);
  });
});

describe('DisclosureItem', () => {
  const item = { itemId: 'd1', userLabel: 'exam worry', reason: 'helps matching' };

  it('requires text for share/generalise and null for withhold', () => {
    expect(DisclosureItem.safeParse({ ...item, choice: 'share', counsellorText: 'Exam stress' }).success).toBe(true);
    expect(DisclosureItem.safeParse({ ...item, choice: 'withhold', counsellorText: null }).success).toBe(true);
    expect(DisclosureItem.safeParse({ ...item, choice: 'share', counsellorText: null }).success).toBe(false);
    expect(DisclosureItem.safeParse({ ...item, choice: 'generalise', counsellorText: '' }).success).toBe(false);
    expect(DisclosureItem.safeParse({ ...item, choice: 'withhold', counsellorText: 'leak' }).success).toBe(false);
  });
});

describe('Proposal vs StoredProposal', () => {
  const proposal = {
    summary: 'You have had four low days, mostly about exams.',
    counsellor: { id: 'c-zhou', displayName: 'Mr. Zhou Yang', matchReasons: ['Speaks Chinese'] },
    slot: { id: 's1', startsAt: '2026-12-01T14:00:00+08:00', mode: 'video', holdExpiresAt: '2026-11-25T23:40:00+08:00' },
    disclosure: [{ itemId: 'd1', choice: 'share', counsellorText: 'Exam stress', userLabel: 'exams', reason: 'r' }],
  };

  it('keeps userLabel out of what the server stores', () => {
    expect(Proposal.safeParse(proposal).success).toBe(true);
    expect(StoredProposal.safeParse(proposal).success).toBe(false);
    const stored = { ...proposal, disclosure: proposal.disclosure.map(({ userLabel: _omit, ...rest }) => rest) };
    expect(StoredProposal.safeParse(stored).success).toBe(true);
  });

  it('rejects a slot time without a timezone offset', () => {
    const bad = { ...proposal, slot: { ...proposal.slot, startsAt: '2026-12-01T14:00:00' } };
    expect(Proposal.safeParse(bad).success).toBe(false);
  });
});

describe('ConfirmRequest', () => {
  it('forbids edited text on a withheld item', () => {
    expect(ConfirmRequest.safeParse({ decisions: [{ itemId: 'd1', choice: 'withhold', editedText: 'x' }] }).success).toBe(false);
    expect(ConfirmRequest.safeParse({ decisions: [{ itemId: 'd1', choice: 'generalise', editedText: 'x' }] }).success).toBe(true);
  });
});

describe('CounsellorBookingView (S4 shape)', () => {
  it('cannot carry owner or revocation fields', () => {
    const view = { refCode: 'HV-7K2Q', slot: { startsAt: '2026-12-01T14:00:00+08:00', mode: 'video' }, items: [] };
    expect(CounsellorBookingView.safeParse(view).success).toBe(true);
    expect(CounsellorBookingView.safeParse({ ...view, ownerHash: 'abc' }).success).toBe(false);
    expect(
      CounsellorBookingView.safeParse({ ...view, items: [{ kind: 'shared', counsellorText: 't', revokedAt: null }] }).success,
    ).toBe(false);
  });
});

describe('LLM tool schemas', () => {
  it('export to JSON Schema with no extra properties allowed', () => {
    for (const schema of [HoldSlotInput, SubmitProposalInput]) {
      const json = z.toJSONSchema(schema) as { type: string; additionalProperties: unknown; required: string[] };
      expect(json.type).toBe('object');
      expect(json.additionalProperties).toBe(false);
      expect(json.required.length).toBeGreaterThan(0);
    }
  });
});
