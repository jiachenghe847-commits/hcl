import { AgentRunView, Booking, Proposal } from '@haven/contracts';
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { MAX_TOOL_CALLS } from '../src/agent/loop';
import { deleteOldRuns, RUN_TTL_MS } from '../src/agent/runs';
import { cancelRun, confirmRun, createRun, getRunView, RATE_LIMIT_PER_DEVICE } from '../src/agent/service';
import { campusDate } from '../src/catalog/time';
import { ApiError } from '../src/http/errors';
import { api, book, freshKey, newDevice, PASSCODE } from './client';
import { call, lastToolResult, say, ScriptedProvider, type Step, throwingProvider } from './fake-llm';

const db = env.DB;
const owner = () => `owner_${crypto.randomUUID()}`;
const request = (message = 'Exams are crushing me and my roommate Li Na keeps shouting. Chinese please, video is fine.') => ({
  locale: 'en' as const,
  role: 'student' as const,
  checkins: [
    { date: '2026-11-23', mood: 2, energy: 2, tags: ['tExams'] },
    { date: '2026-11-24', mood: 2, energy: 3, tags: ['tExams', 'tSleep'] },
  ],
  message,
});

const disclosure = [
  { itemId: 'd1', choice: 'share', counsellorText: 'Stress about upcoming exams', userLabel: 'exams', reason: 'Main concern' },
  { itemId: 'd2', choice: 'generalise', counsellorText: 'Ongoing conflict with a housemate', userLabel: 'roommate', reason: 'Context' },
  { itemId: 'd3', choice: 'withhold', counsellorText: null, userLabel: 'name', reason: 'Not needed' },
];

/** search → list → hold the first slot → submit. Optional tweaks to the submission. */
function happyScript(overrides: Record<string, unknown> = {}): Step[] {
  let slotId = '';
  return [
    () => call('search_counsellors', { language: 'zh', focusArea: 'academic_stress', mode: 'video' }),
    (req) => call('list_open_slots', { counsellorId: lastToolResult(req)[0].id, from: campusDate(new Date()), to: campusDate(new Date(), 14) }),
    (req) => {
      slotId = lastToolResult(req)[0].id;
      return call('hold_slot', { slotId });
    },
    () =>
      call('submit_proposal', {
        summary: 'Two low days, mostly about exams.',
        counsellorId: slotId.split('-').slice(0, 2).join('-'),
        slotId,
        mode: 'video',
        matchReasons: ['Speaks Chinese', 'Offers video sessions'],
        disclosure,
        ...overrides,
      }),
  ];
}

async function proposedRun(ownerHash = owner(), script = happyScript()) {
  const provider = new ScriptedProvider(script);
  const { run } = await createRun({ db, provider, ownerHash, idempotencyKey: freshKey(), request: request(), now: new Date() });
  return { run, ownerHash, provider };
}

const isHeld = async (slotId: string) =>
  !!(await db.prepare('SELECT 1 FROM slots WHERE id = ? AND hold_expires_at > ?').bind(slotId, new Date().toISOString()).first());

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : String(e);
  }
};

describe('create: the loop produces a proposal and holds one slot', () => {
  it('runs search → list → hold → submit and returns a contract-valid proposal', async () => {
    const { run, ownerHash } = await proposedRun();
    expect(run.status).toBe('proposed');
    const proposal = Proposal.parse(run.proposal);
    expect(proposal.counsellor.id).toBe('c-tan'); // speaks Chinese, offers video, focus includes academic_stress
    expect(await isHeld(proposal.slot.id)).toBe(true);
    expect(run.trace.map((s) => s.kind)).toEqual(
      expect.arrayContaining(['safety_check', 'llm_turn', 'tool_call', 'tool_result']),
    );

    // GET returns the stored view: the same proposal without user-side labels.
    const view = AgentRunView.parse(await getRunView(db, run.id, ownerHash, new Date()));
    expect(JSON.stringify(view)).not.toContain('userLabel');
  });

  it('S3: the model only ever sees the server-redacted message', async () => {
    const { provider } = await proposedRun();
    const sent = JSON.stringify(provider.requests[0]!.messages);
    expect(sent).toContain('roommate'); // the content is there
    const leaky = new ScriptedProvider(happyScript());
    await createRun({ db, provider: leaky, ownerHash: owner(), idempotencyKey: freshKey(), request: request('call 012-345 6789 or li@x.my'), now: new Date() });
    const first = JSON.stringify(leaky.requests[0]!.messages);
    expect(first).not.toMatch(/012-345|li@x\.my/);
    expect(first).toContain('[phone]');
  });

  it('a held slot cannot be booked manually by someone else (fail closed)', async () => {
    const { run } = await proposedRun();
    const other = await book(run.proposal!.slot.id, { device: newDevice() });
    expect(other.json.error?.code).toBe('slot_unavailable');
  });

  it('S7: the validator withholds proposal items that contain identifiers', async () => {
    const leaky = [{ itemId: 'd1', choice: 'share', counsellorText: 'Reach me at 012-345 6789', userLabel: 'phone', reason: 'r' }];
    const { run } = await proposedRun(owner(), happyScript({ disclosure: leaky }));
    expect(run.proposal!.disclosure[0]).toMatchObject({ choice: 'withhold', counsellorText: null });
    expect(run.trace.some((s) => s.kind === 'validation')).toBe(true);
  });

  it('recovers when the model submits before holding: the error goes back to the model', async () => {
    let slotId = '';
    const script: Step[] = [
      () => call('list_open_slots', { counsellorId: 'c-zhou', from: campusDate(new Date()), to: campusDate(new Date(), 14) }),
      (req) => {
        slotId = lastToolResult(req)[0].id;
        return call('submit_proposal', { summary: 's', counsellorId: 'c-zhou', slotId, mode: 'video', matchReasons: ['r'], disclosure: [] });
      },
      (req) => {
        expect(lastToolResult(req).error).toMatch(/not held/);
        return call('hold_slot', { slotId });
      },
      () => call('submit_proposal', { summary: 's', counsellorId: 'c-zhou', slotId, mode: 'video', matchReasons: ['r'], disclosure: [] }),
    ];
    const { run } = await proposedRun(owner(), script);
    expect(run.status).toBe('proposed');
  });

  it('rejects a mode the counsellor does not offer', async () => {
    const script = happyScript({ mode: 'chat' }); // Dr. Tan does not offer chat
    script.push(() => say('giving up'));
    const { run } = await proposedRun(owner(), script);
    expect(run.status).toBe('failed');
  });
});

describe('create: failures leave nothing behind', () => {
  async function failedWith(script: Step[]) {
    const { run } = await proposedRun(owner(), script);
    const held = await db.prepare('SELECT COUNT(*) AS n FROM slots WHERE hold_run_id = ?').bind(run.id).first<{ n: number }>();
    return { run, held: held!.n };
  }

  it('the model stops without proposing → failed, hold released', async () => {
    const script = happyScript().slice(0, 3);
    script.push(() => say('I think you should rest.'));
    const { run, held } = await failedWith(script);
    expect(run.status).toBe('failed');
    expect(held).toBe(0);
  });

  it('the tool call limit is enforced', async () => {
    const script: Step[] = Array.from({ length: MAX_TOOL_CALLS + 2 }, () => () => call('search_counsellors', {}));
    const { run } = await failedWith(script);
    expect(run.status).toBe('failed');
    expect(run.trace.at(-1)!.summary).toMatch(/tool call limit/);
  });

  it('a provider error → failed, hold released, no exception to the caller', async () => {
    const script = happyScript().slice(0, 3);
    script.push(() => {
      throw new Error('network down');
    });
    const { run, held } = await failedWith(script);
    expect(run.status).toBe('failed');
    expect(held).toBe(0);
  });

  it('a refusal stops the loop', async () => {
    const { run } = await failedWith([() => ({ stopReason: 'refusal', blocks: [], raw: [] })]);
    expect(run.status).toBe('failed');
  });
});

describe('S2 crisis gate and limits', () => {
  it('a crisis message makes no LLM call and holds nothing', async () => {
    const { run } = await createRun({
      db,
      provider: throwingProvider,
      ownerHash: owner(),
      idempotencyKey: freshKey(),
      request: request('I want to kill myself'),
      now: new Date(),
    });
    expect(run.status).toBe('crisis');
    expect(run.trace).toHaveLength(1);
    expect(run.trace[0]).toMatchObject({ kind: 'safety_check', detail: { level: 'crisis', categories: ['suicide'] } });
  });

  it('over HTTP: crisis works even with no LLM configured; anything else is llm_unavailable', async () => {
    const device = newDevice();
    const post = (message: string) =>
      api('/agent/runs', { method: 'POST', device, headers: { 'Idempotency-Key': freshKey() }, body: request(message) });
    const crisis = await post('我不想活了');
    expect(crisis.status).toBe(201);
    expect(crisis.json.status).toBe('crisis');
    const normal = await post('exam stress');
    expect(normal.status).toBe(503);
    expect(normal.json.error.code).toBe('llm_unavailable');
  });

  it('same Idempotency-Key → same run, model called once', async () => {
    const provider = new ScriptedProvider(happyScript());
    const ownerHash = owner();
    const key = freshKey();
    const a = await createRun({ db, provider, ownerHash, idempotencyKey: key, request: request(), now: new Date() });
    const b = await createRun({ db, provider, ownerHash, idempotencyKey: key, request: request(), now: new Date() });
    expect(b.replayed).toBe(true);
    expect(b.run.id).toBe(a.run.id);
    expect(provider.requests).toHaveLength(4);
    expect(await codeOf(createRun({ db, provider, ownerHash: owner(), idempotencyKey: key, request: request(), now: new Date() }))).toBe('conflict');
  });

  it('per-device rate limit fails closed, but never blocks a crisis', async () => {
    const ownerHash = owner();
    const now = new Date().toISOString();
    await db.batch(
      Array.from({ length: RATE_LIMIT_PER_DEVICE }, (_, i) =>
        db
          .prepare(`INSERT INTO agent_runs (id, owner_hash, status, idempotency_key, created_at, expires_at) VALUES (?, ?, 'failed', ?, ?, ?)`)
          .bind(`run_rl_${i}_${ownerHash}`, ownerHash, `rl_${i}_${ownerHash}`, now, now),
      ),
    );
    const go = (message: string) => createRun({ db, provider: throwingProvider, ownerHash, idempotencyKey: freshKey(), request: request(message), now: new Date() });
    expect(await codeOf(go('exam stress'))).toBe('rate_limited');
    expect((await go('I want to die')).run.status).toBe('crisis');
  });
});

describe('S5 confirm, cancel, expiry', () => {
  it('confirm books with the user’s decisions; a missing decision means withhold', async () => {
    const { run, ownerHash } = await proposedRun();
    const booking = Booking.parse(
      await confirmRun(db, run.id, ownerHash, { decisions: [{ itemId: 'd1', choice: 'share' }, { itemId: 'd2', choice: 'withhold' }] }, new Date()),
    );
    expect(booking.items.map((i) => i.counsellorText)).toEqual(['Stress about upcoming exams']);
    expect(booking.slot.id).toBe(run.proposal!.slot.id);
    expect(await isHeld(booking.slot.id)).toBe(false);
    expect((await getRunView(db, run.id, ownerHash, new Date())).status).toBe('confirmed');

    // The counsellor sees exactly that one item.
    const view = await api(`/counsellor/${booking.counsellor.id}/bookings`, { device: null, headers: { 'X-Haven-Demo-Passcode': PASSCODE } });
    const mine = view.json.find((v: { refCode: string }) => v.refCode === booking.refCode);
    expect(mine.items).toEqual([{ kind: 'shared', counsellorText: 'Stress about upcoming exams' }]);
  });

  it('confirm twice → the same booking; only one booking row', async () => {
    const { run, ownerHash } = await proposedRun();
    const body = { decisions: [{ itemId: 'd1', choice: 'share' as const }] };
    const a = await confirmRun(db, run.id, ownerHash, body, new Date());
    const b = await confirmRun(db, run.id, ownerHash, body, new Date());
    expect(b.id).toBe(a.id);
    const n = await db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE agent_run_id = ?').bind(run.id).first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it('S7 on confirm: edited text with an identifier is withheld; unknown item ids are rejected', async () => {
    const { run, ownerHash } = await proposedRun();
    expect(await codeOf(confirmRun(db, run.id, ownerHash, { decisions: [{ itemId: 'zz', choice: 'share' }] }, new Date()))).toBe('validation_failed');
    const booking = await confirmRun(
      db,
      run.id,
      ownerHash,
      { decisions: [{ itemId: 'd1', choice: 'share', editedText: 'Exam stress, my ID is CST2504000' }, { itemId: 'd2', choice: 'generalise' }] },
      new Date(),
    );
    expect(booking.items.map((i) => i.counsellorText)).toEqual(['Ongoing conflict with a housemate']);
  });

  it('after the hold expires, confirm fails closed and the run is expired', async () => {
    const { run, ownerHash } = await proposedRun();
    const later = new Date(Date.now() + RUN_TTL_MS + 60_000);
    expect(await codeOf(confirmRun(db, run.id, ownerHash, { decisions: [] }, later))).toBe('hold_expired');
    expect((await getRunView(db, run.id, ownerHash, later)).status).toBe('expired');
    expect(await db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE agent_run_id = ?').bind(run.id).first()).toEqual({ n: 0 });
  });

  it('cancel releases the hold, twice is a no-op, and confirm afterwards is refused', async () => {
    const { run, ownerHash } = await proposedRun();
    const a = await cancelRun(db, run.id, ownerHash, new Date());
    const b = await cancelRun(db, run.id, ownerHash, new Date());
    expect(a.status).toBe('cancelled');
    expect(b).toEqual(a);
    expect(await isHeld(run.proposal!.slot.id)).toBe(false);
    expect(await codeOf(confirmRun(db, run.id, ownerHash, { decisions: [] }, new Date()))).toBe('conflict');
  });

  it('another device cannot read, confirm or cancel a run', async () => {
    const { run } = await proposedRun();
    expect(await codeOf(getRunView(db, run.id, owner(), new Date()))).toBe('not_found');
    expect(await codeOf(confirmRun(db, run.id, owner(), { decisions: [] }, new Date()))).toBe('not_found');
    expect(await codeOf(cancelRun(db, run.id, owner(), new Date()))).toBe('not_found');
  });
});

describe('Q1 retention', () => {
  it('deletes runs and traces older than 24 h, keeps recent ones', async () => {
    const { run } = await proposedRun();
    await deleteOldRuns(db, new Date());
    expect(await db.prepare('SELECT 1 FROM agent_runs WHERE id = ?').bind(run.id).first()).not.toBeNull();
    await deleteOldRuns(db, new Date(Date.now() + 25 * 3600_000));
    expect(await db.prepare('SELECT 1 FROM agent_runs WHERE id = ?').bind(run.id).first()).toBeNull();
    expect(await db.prepare('SELECT 1 FROM agent_steps WHERE run_id = ?').bind(run.id).first()).toBeNull();
  });
});

