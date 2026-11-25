/**
 * Turns a submit_proposal call into a Proposal, or explains to the model why it was rejected.
 * The server re-checks everything the model claims:
 * - the slot is held by this run;
 * - the counsellor owns that slot and offers the mode;
 * - every disclosure text passes S7.
 */
import { type Proposal, type StoredProposal, SubmitProposalInput } from '@haven/contracts';
import { findIdentifiers } from '@haven/safety';
import { getCounsellor } from '../catalog/counsellors.js';
import { heldSlotOf, type RunRow } from './runs.js';
import { ToolInputError } from './tools.js';

export interface BuiltProposal {
  proposal: Proposal;
  stored: StoredProposal;
  /** Items the validator forced to withhold (ids only, for the trace). */
  downgraded: string[];
}

export async function buildProposal(db: D1Database, run: RunRow, input: unknown, now: Date): Promise<BuiltProposal> {
  const parsed = SubmitProposalInput.safeParse(input);
  if (!parsed.success) {
    throw new ToolInputError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const p = parsed.data;

  if ((await heldSlotOf(db, run.id, now)) !== p.slotId) {
    throw new ToolInputError('slotId is not held by you. Call hold_slot on it first.');
  }
  const slot = await db.prepare('SELECT counsellor_id, starts_at FROM slots WHERE id = ?').bind(p.slotId).first<{ counsellor_id: string; starts_at: string }>();
  const counsellor = await getCounsellor(db, p.counsellorId);
  if (!slot || !counsellor || slot.counsellor_id !== counsellor.id) throw new ToolInputError('counsellorId does not match the held slot.');
  if (!counsellor.modes.includes(p.mode)) throw new ToolInputError(`This counsellor offers only: ${counsellor.modes.join(', ')}.`);

  const downgraded: string[] = [];
  const disclosure = p.disclosure.map((d) => {
    if (d.choice !== 'withhold' && d.counsellorText && findIdentifiers(d.counsellorText).length > 0) {
      downgraded.push(d.itemId);
      return { ...d, choice: 'withhold' as const, counsellorText: null };
    }
    return d;
  });

  const ids = new Set(disclosure.map((d) => d.itemId));
  if (ids.size !== disclosure.length) throw new ToolInputError('disclosure itemIds must be unique.');

  const base = {
    summary: p.summary,
    counsellor: { id: counsellor.id, displayName: counsellor.displayName, matchReasons: p.matchReasons },
    slot: { id: p.slotId, startsAt: slot.starts_at, mode: p.mode, holdExpiresAt: run.expires_at },
  };
  return {
    proposal: { ...base, disclosure },
    stored: { ...base, disclosure: disclosure.map(({ userLabel: _label, ...rest }) => rest) },
    downgraded,
  };
}
