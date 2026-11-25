/**
 * Agent run use-cases: create (S2 crisis gate → rate limit → loop), view, confirm (S5), cancel.
 * The LLM never books. Only confirmRun writes a booking, after the user's decisions, inside one atomic batch.
 */
import type { AgentRunCreated, AgentRunRequest, AgentRunView, Booking, ConfirmRequest, StoredProposal } from '@haven/contracts';
import { detectCrisis, redactIdentifiers } from '@haven/safety';
import { insertBookingStatements, newId, newRefCode, type NewItem, withholdUnsafeItems } from '../booking/commands.js';
import { getOwnedBooking } from '../booking/views.js';
import { ApiError } from '../http/errors.js';
import type { LlmProvider } from '../llm/provider.js';
import { runLoop } from './loop.js';
import {
  countRunsSince,
  getRun,
  getRunByKey,
  heldSlotOf,
  insertRun,
  loadTrace,
  newRunId,
  releaseHolds,
  type RunRow,
  setStatus,
  Trace,
} from './runs.js';

export const RATE_LIMIT_PER_DEVICE = 20;
export const RATE_LIMIT_GLOBAL = 300;

async function view(db: D1Database, run: RunRow): Promise<AgentRunView> {
  return {
    id: run.id,
    status: run.status,
    expiresAt: run.expires_at,
    proposal: run.proposal ? (JSON.parse(run.proposal) as StoredProposal) : null,
    trace: await loadTrace(db, run.id),
  };
}

/** Owner-only lookup. If a proposal has passed its expiry, it is expired and its hold released first. */
async function ownedRun(db: D1Database, id: string, ownerHash: string, now: Date): Promise<RunRow> {
  const run = await getRun(db, id);
  if (!run || run.owner_hash !== ownerHash) throw new ApiError('not_found', 'No such run');
  if ((run.status === 'proposed' || run.status === 'running') && run.expires_at <= now.toISOString()) {
    await setStatus(db, run.id, run.status, 'expired');
    await releaseHolds(db, run.id);
    return (await getRun(db, id))!;
  }
  return run;
}

export async function createRun(deps: {
  db: D1Database;
  provider: LlmProvider | null;
  ownerHash: string;
  idempotencyKey: string;
  request: AgentRunRequest;
  now: Date;
}): Promise<{ run: AgentRunCreated | AgentRunView; replayed: boolean }> {
  const { db, ownerHash, request, now } = deps;

  // A replay returns the stored view: same run, but without user-side labels (those exist only in the first response).
  const prior = await getRunByKey(db, deps.idempotencyKey);
  if (prior) {
    if (prior.owner_hash !== ownerHash) throw new ApiError('conflict', 'Idempotency-Key already used');
    return { run: await view(db, prior), replayed: true };
  }

  const latestMood = request.checkins.at(-1)?.mood;
  const crisis = detectCrisis({ ...(request.message ? { text: request.message } : {}), ...(latestMood ? { latestMood } : {}) });

  // S2: crisis check first. A crisis run makes no LLM call and is never rate limited.
  if (crisis.level !== 'crisis') {
    const dayAgo = new Date(now.getTime() - 24 * 3600_000);
    if ((await countRunsSince(db, dayAgo, ownerHash)) >= RATE_LIMIT_PER_DEVICE) throw new ApiError('rate_limited', 'Daily limit reached on this device');
    if ((await countRunsSince(db, dayAgo)) >= RATE_LIMIT_GLOBAL) throw new ApiError('rate_limited', 'Haven is busy today; please book manually');
    if (!deps.provider) throw new ApiError('llm_unavailable', 'The assistant is not available; please book manually');
  }

  const run = await insertRun(db, { id: newRunId(), ownerHash, key: deps.idempotencyKey, now });
  const trace = new Trace(db, run.id);
  await trace.add('safety_check', `Crisis check: ${crisis.level}`, { level: crisis.level, categories: crisis.categories });

  if (crisis.level === 'crisis') {
    await setStatus(db, run.id, 'running', 'crisis');
    return { run: { id: run.id, status: 'crisis', expiresAt: run.expires_at, proposal: null, trace: trace.steps }, replayed: false };
  }

  // S3 defence in depth: redact again on the server (the device also redacted, with the user's own name list).
  const redacted = request.message ? redactIdentifiers(request.message).text : undefined;
  try {
    const result = await runLoop({ db, provider: deps.provider!, run, request, redactedMessage: redacted, trace });
    if (result.ok) {
      await setStatus(db, run.id, 'running', 'proposed', result.built.stored);
      return { run: { id: run.id, status: 'proposed', expiresAt: run.expires_at, proposal: result.built.proposal, trace: trace.steps }, replayed: false };
    }
    await trace.add('error', `No proposal: ${result.reason}`);
  } catch (err) {
    console.error('agent loop failed', err);
    await trace.add('error', 'The assistant failed unexpectedly');
  }
  await releaseHolds(db, run.id);
  await setStatus(db, run.id, 'running', 'failed');
  return { run: { id: run.id, status: 'failed', expiresAt: run.expires_at, proposal: null, trace: trace.steps }, replayed: false };
}

export async function getRunView(db: D1Database, id: string, ownerHash: string, now: Date): Promise<AgentRunView> {
  return view(db, await ownedRun(db, id, ownerHash, now));
}

export async function cancelRun(db: D1Database, id: string, ownerHash: string, now: Date): Promise<AgentRunView> {
  const run = await ownedRun(db, id, ownerHash, now);
  if (run.status === 'proposed' || run.status === 'running') {
    await setStatus(db, run.id, run.status, 'cancelled');
    await releaseHolds(db, run.id);
  }
  return view(db, (await getRun(db, id))!);
}

/** Applies the user's decisions. A missing decision means withhold (fail closed). */
function itemsFromDecisions(proposal: StoredProposal, req: ConfirmRequest): NewItem[] {
  const decisions = new Map(req.decisions.map((d) => [d.itemId, d]));
  const items: NewItem[] = [];
  for (const item of proposal.disclosure) {
    const d = decisions.get(item.itemId);
    if (!d || d.choice === 'withhold') continue;
    const text = d.editedText ?? item.counsellorText;
    if (!text) continue;
    items.push({ kind: d.choice === 'share' ? 'shared' : 'generalised', counsellorText: text });
  }
  return withholdUnsafeItems(items); // S7 again: edited text is user-written
}

export async function confirmRun(db: D1Database, id: string, ownerHash: string, req: ConfirmRequest, now: Date): Promise<Booking> {
  const key = `run:${id}`;
  const run = await ownedRun(db, id, ownerHash, now);

  if (run.status === 'confirmed') {
    const prior = await db.prepare('SELECT id FROM bookings WHERE idempotency_key = ?').bind(key).first<{ id: string }>();
    if (prior) return (await getOwnedBooking(db, prior.id, ownerHash))!;
  }
  if (run.status === 'expired') throw new ApiError('hold_expired', 'This proposal expired; nothing was booked');
  if (run.status !== 'proposed' || !run.proposal) throw new ApiError('conflict', `Run is ${run.status}; nothing was booked`);

  const proposal = JSON.parse(run.proposal) as StoredProposal;
  const unknown = req.decisions.find((d) => !proposal.disclosure.some((i) => i.itemId === d.itemId));
  if (unknown) throw new ApiError('validation_failed', `Unknown itemId ${unknown.itemId}`);

  const bookingId = newId('bk');
  const refCode = newRefCode();
  const statements = [
    ...insertBookingStatements(
      db,
      { id: bookingId, refCode, ownerHash, slotId: proposal.slot.id, mode: proposal.slot.mode, idempotencyKey: key, agentRunId: run.id, now, allowedHoldRunId: run.id },
      itemsFromDecisions(proposal, req),
    ),
    db.prepare('UPDATE slots SET hold_run_id = NULL, hold_expires_at = NULL WHERE hold_run_id = ? AND EXISTS (SELECT 1 FROM bookings WHERE id = ?)').bind(run.id, bookingId),
    db.prepare(`UPDATE agent_runs SET status = 'confirmed' WHERE id = ? AND status = 'proposed' AND EXISTS (SELECT 1 FROM bookings WHERE id = ?)`).bind(run.id, bookingId),
  ];
  let inserted: D1Result | undefined;
  try {
    [inserted] = await db.batch(statements);
  } catch (err) {
    // A concurrent confirm of the same run won the race: return its booking.
    if (err instanceof Error && err.message.includes('bookings.idempotency_key')) return confirmRun(db, id, ownerHash, req, now);
    throw err;
  }
  if (!inserted || inserted.meta.changes === 0) {
    const stillHeld = (await heldSlotOf(db, run.id, now)) === proposal.slot.id;
    throw stillHeld ? new ApiError('slot_unavailable', 'That time was taken; nothing was booked') : new ApiError('hold_expired', 'The hold expired; nothing was booked');
  }
  return (await getOwnedBooking(db, bookingId, ownerHash))!;
}
