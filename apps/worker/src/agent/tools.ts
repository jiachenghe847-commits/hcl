/**
 * The four LLM-facing tools (CONTRACTS.md §6).
 * Read tools and hold_slot execute here. submit_proposal is validated by the loop (proposal.ts) because it ends the run.
 * Tool inputs are validated with the contract schemas before anything runs.
 */
import { HoldSlotInput, ListOpenSlotsInput, SearchCounsellorsInput, SubmitProposalInput } from '@haven/contracts';
import { z } from 'zod';
import { listCounsellors } from '../catalog/counsellors.js';
import { HORIZON_DAYS, listOpenSlots } from '../catalog/slots.js';
import { campusDate } from '../catalog/time.js';
import type { ToolSpec } from '../llm/provider.js';
import { holdSlot, type RunRow } from './runs.js';

const schema = (s: z.ZodType) => z.toJSONSchema(s) as Record<string, unknown>;

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'search_counsellors',
    description: 'Find campus counsellors. All filters are optional. Returns up to 5 counsellors with languages, focus areas and modes.',
    inputSchema: schema(SearchCounsellorsInput),
  },
  {
    name: 'list_open_slots',
    description: 'List up to 10 open session times for one counsellor between two campus dates (YYYY-MM-DD, at most 14 days ahead).',
    inputSchema: schema(ListOpenSlotsInput),
  },
  {
    name: 'hold_slot',
    description:
      'Reserve one slot for this user for 10 minutes while they review. Holding a new slot releases the previous hold. Fails if the slot was just taken.',
    inputSchema: schema(HoldSlotInput),
  },
  {
    name: 'submit_proposal',
    description:
      'Finish: propose the held slot and a disclosure plan. Call exactly once, after hold_slot succeeded. The user reviews everything before anything is booked.',
    inputSchema: schema(SubmitProposalInput),
  },
];

export class ToolInputError extends Error {}

function parse<S extends z.ZodType>(s: S, input: unknown): z.infer<S> {
  const r = s.safeParse(input);
  if (!r.success) throw new ToolInputError(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
}

/** Runs a read or hold tool and returns the JSON result for the model. */
export async function runTool(db: D1Database, run: RunRow, name: string, input: unknown, now: Date): Promise<unknown> {
  switch (name) {
    case 'search_counsellors': {
      const q = parse(SearchCounsellorsInput, input);
      const all = await listCounsellors(db);
      return all
        .filter((c) => (!q.language || c.languages.includes(q.language)) && (!q.mode || c.modes.includes(q.mode)))
        .sort((a, b) => Number(!!q.focusArea && b.focusAreas.includes(q.focusArea)) - Number(!!q.focusArea && a.focusAreas.includes(q.focusArea)))
        .slice(0, 5);
    }
    case 'list_open_slots': {
      const q = parse(ListOpenSlotsInput, input);
      const last = campusDate(now, HORIZON_DAYS);
      const from = q.from < campusDate(now) ? campusDate(now) : q.from;
      const to = q.to > last ? last : q.to;
      if (to < from) return [];
      return listOpenSlots(db, now, { counsellorId: q.counsellorId, from, to, limit: 10 });
    }
    case 'hold_slot': {
      const q = parse(HoldSlotInput, input);
      const ok = await holdSlot(db, run, q.slotId, now);
      if (!ok) throw new ToolInputError('slot_unavailable: that slot is booked, held by someone else, or in the past. Choose another.');
      return { held: true, slotId: q.slotId, holdExpiresAt: run.expires_at };
    }
    default:
      throw new ToolInputError(`Unknown tool ${name}`);
  }
}
