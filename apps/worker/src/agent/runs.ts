/**
 * Persistence for agent runs, their trace steps and their slot hold (CONTRACTS.md §3, §5).
 * A run holds at most one slot, and the hold expires with the run.
 */
import type { RunStatus, StoredProposal, TraceStep } from '@haven/contracts';
import { campusIso } from '../catalog/time.js';

export const RUN_TTL_MS = 10 * 60_000;

export interface RunRow {
  id: string;
  owner_hash: string;
  status: RunStatus;
  proposal: string | null;
  idempotency_key: string;
  created_at: string;
  expires_at: string;
}

export const newRunId = () => `run_${crypto.randomUUID().replaceAll('-', '')}`;

export async function insertRun(
  db: D1Database,
  r: { id: string; ownerHash: string; key: string; now: Date },
): Promise<RunRow> {
  const row: RunRow = {
    id: r.id,
    owner_hash: r.ownerHash,
    status: 'running',
    proposal: null,
    idempotency_key: r.key,
    created_at: r.now.toISOString(),
    expires_at: new Date(r.now.getTime() + RUN_TTL_MS).toISOString(),
  };
  await db
    .prepare('INSERT INTO agent_runs (id, owner_hash, status, idempotency_key, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(row.id, row.owner_hash, row.status, row.idempotency_key, row.created_at, row.expires_at)
    .run();
  return row;
}

export const getRun = (db: D1Database, id: string) => db.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first<RunRow>();
export const getRunByKey = (db: D1Database, key: string) =>
  db.prepare('SELECT * FROM agent_runs WHERE idempotency_key = ?').bind(key).first<RunRow>();

/** Moves a run between states only from the expected one, so a repeated call changes nothing. */
export async function setStatus(
  db: D1Database,
  id: string,
  from: RunStatus,
  to: RunStatus,
  proposal?: StoredProposal,
): Promise<boolean> {
  const res = await db
    .prepare('UPDATE agent_runs SET status = ?, proposal = COALESCE(?, proposal) WHERE id = ? AND status = ?')
    .bind(to, proposal ? JSON.stringify(proposal) : null, id, from)
    .run();
  return res.meta.changes > 0;
}

export async function countRunsSince(db: D1Database, since: Date, ownerHash?: string): Promise<number> {
  const row = ownerHash
    ? await db.prepare('SELECT COUNT(*) AS n FROM agent_runs WHERE created_at >= ? AND owner_hash = ?').bind(since.toISOString(), ownerHash).first<{ n: number }>()
    : await db.prepare('SELECT COUNT(*) AS n FROM agent_runs WHERE created_at >= ?').bind(since.toISOString()).first<{ n: number }>();
  return row?.n ?? 0;
}

// ---- trace ----

export class Trace {
  private seq = 0;
  readonly steps: TraceStep[] = [];
  constructor(
    private readonly db: D1Database,
    private readonly runId: string,
  ) {}

  /** `detail` must already be free of raw user text. */
  async add(kind: TraceStep['kind'], summary: string, detail: unknown = null): Promise<void> {
    const step: TraceStep = { seq: this.seq++, kind, summary, detail, createdAt: new Date().toISOString() };
    this.steps.push(step);
    await this.db
      .prepare('INSERT INTO agent_steps (run_id, seq, kind, summary, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(this.runId, step.seq, step.kind, step.summary, detail === null ? null : JSON.stringify(detail), step.createdAt)
      .run();
  }
}

export async function loadTrace(db: D1Database, runId: string): Promise<TraceStep[]> {
  const { results } = await db
    .prepare('SELECT seq, kind, summary, detail, created_at FROM agent_steps WHERE run_id = ? ORDER BY seq')
    .bind(runId)
    .all<{ seq: number; kind: TraceStep['kind']; summary: string; detail: string | null; created_at: string }>();
  return results.map((r) => ({ seq: r.seq, kind: r.kind, summary: r.summary, detail: r.detail ? JSON.parse(r.detail) : null, createdAt: r.created_at }));
}

// ---- holds ----

/**
 * Holds `slotId` for this run until the run expires, then releases any other slot the run held.
 * Succeeds only if the slot is in the future, not booked, and not held by another live run.
 * Holding the same slot again is a no-op success.
 */
export async function holdSlot(db: D1Database, run: RunRow, slotId: string, now: Date): Promise<boolean> {
  const held = await db
    .prepare(
      `UPDATE slots SET hold_run_id = ?1, hold_expires_at = ?2
       WHERE id = ?3 AND starts_at > ?4
         AND (hold_expires_at IS NULL OR hold_expires_at <= ?5 OR hold_run_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = ?3 AND b.status = 'confirmed')`,
    )
    .bind(run.id, run.expires_at, slotId, campusIso(now), now.toISOString())
    .run();
  if (held.meta.changes === 0) return false;
  await db.prepare('UPDATE slots SET hold_run_id = NULL, hold_expires_at = NULL WHERE hold_run_id = ? AND id != ?').bind(run.id, slotId).run();
  return true;
}

export async function heldSlotOf(db: D1Database, runId: string, now: Date): Promise<string | null> {
  const row = await db
    .prepare('SELECT id FROM slots WHERE hold_run_id = ? AND hold_expires_at > ?')
    .bind(runId, now.toISOString())
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function releaseHolds(db: D1Database, runId: string): Promise<void> {
  await db.prepare('UPDATE slots SET hold_run_id = NULL, hold_expires_at = NULL WHERE hold_run_id = ?').bind(runId).run();
}

/** Q1: traces are kept 24 h. Runs older than that are deleted with their steps; bookings keep only the run id. */
export async function deleteOldRuns(db: D1Database, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - 24 * 3600_000).toISOString();
  await db.batch([
    db.prepare('DELETE FROM agent_steps WHERE run_id IN (SELECT id FROM agent_runs WHERE created_at < ?)').bind(cutoff),
    db.prepare('DELETE FROM agent_runs WHERE created_at < ?').bind(cutoff),
  ]);
}
