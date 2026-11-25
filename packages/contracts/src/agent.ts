/**
 * Agent run bodies and LLM tool inputs (CONTRACTS.md §4–6).
 * Request bodies are strict objects: unknown keys are rejected.
 * That is how S3 is enforced at the boundary: a check-in that still carries a private `note` cannot be sent.
 */
import { z } from 'zod';
import { DisclosureChoice, FocusArea, Id, IsoDate, IsoDateTime, ItemId, Language, Locale, Mode, Role } from './common.js';

const Rating = z.int().min(1).max(5);

export const CheckinSummary = z.strictObject({
  date: IsoDate,
  mood: Rating,
  energy: Rating,
  tags: z.array(z.string().max(32)).max(10),
});

export const AgentRunRequest = z.strictObject({
  locale: Locale,
  role: Role,
  checkins: z.array(CheckinSummary).max(14),
  /** Already redacted on the device. */
  message: z.string().max(1000).optional(),
  preferences: z
    .strictObject({
      languages: z.array(Language).max(3).optional(),
      modes: z.array(Mode).max(3).optional(),
      availability: z.string().max(200).optional(),
    })
    .optional(),
});

const textRequiredUnlessWithheld = (d: { choice: DisclosureChoice; counsellorText: string | null }) =>
  d.choice === 'withhold' ? d.counsellorText === null : d.counsellorText !== null && d.counsellorText.length > 0;

export const DisclosureItem = z
  .strictObject({
    itemId: ItemId,
    choice: DisclosureChoice,
    /** Exactly what the counsellor would see; null when withheld. */
    counsellorText: z.string().max(280).nullable(),
    /** Which part of the user's message this is. Shown to the user only, never stored on the server. */
    userLabel: z.string().max(120),
    reason: z.string().max(200),
  })
  .refine(textRequiredUnlessWithheld, { message: 'counsellorText must be null for withhold and non-empty otherwise' });

export const StoredDisclosureItem = z
  .strictObject({
    itemId: ItemId,
    choice: DisclosureChoice,
    counsellorText: z.string().max(280).nullable(),
    reason: z.string().max(200),
  })
  .refine(textRequiredUnlessWithheld, { message: 'counsellorText must be null for withhold and non-empty otherwise' });

const ProposalBase = {
  summary: z.string().min(1).max(400),
  counsellor: z.strictObject({
    id: Id,
    displayName: z.string(),
    matchReasons: z.array(z.string().max(160)).min(1).max(3),
  }),
  slot: z.strictObject({ id: Id, startsAt: IsoDateTime, mode: Mode, holdExpiresAt: IsoDateTime }),
};

/** Returned once, by the create call. */
export const Proposal = z.strictObject({ ...ProposalBase, disclosure: z.array(DisclosureItem).max(8) });
/** What the server keeps and what GET returns: no user-side labels. */
export const StoredProposal = z.strictObject({ ...ProposalBase, disclosure: z.array(StoredDisclosureItem).max(8) });

export const ConfirmRequest = z.strictObject({
  decisions: z
    .array(
      z
        .strictObject({ itemId: ItemId, choice: DisclosureChoice, editedText: z.string().min(1).max(280).optional() })
        .refine((d) => !(d.choice === 'withhold' && d.editedText !== undefined), {
          message: 'editedText is not allowed when withholding',
        }),
    )
    .max(8),
});

export const RunStatus = z.enum(['running', 'proposed', 'confirmed', 'cancelled', 'expired', 'failed', 'crisis']);
export const TraceStep = z.strictObject({
  seq: z.int().nonnegative(),
  kind: z.enum(['safety_check', 'llm_turn', 'tool_call', 'tool_result', 'validation', 'error']),
  summary: z.string(),
  detail: z.unknown().nullable(),
  createdAt: IsoDateTime,
});

const RunBase = { id: Id, status: RunStatus, expiresAt: IsoDateTime, trace: z.array(TraceStep) };
export const AgentRunCreated = z.strictObject({ ...RunBase, proposal: Proposal.nullable() });
export const AgentRunView = z.strictObject({ ...RunBase, proposal: StoredProposal.nullable() });

// ---- LLM tool inputs (§6). These are converted to JSON Schema for the provider. ----

export const SearchCounsellorsInput = z.strictObject({
  language: Language.optional(),
  focusArea: FocusArea.optional(),
  mode: Mode.optional(),
});
export const ListOpenSlotsInput = z.strictObject({ counsellorId: Id, from: IsoDate, to: IsoDate });
export const HoldSlotInput = z.strictObject({ slotId: Id });
export const SubmitProposalInput = z.strictObject({
  summary: ProposalBase.summary,
  counsellorId: Id,
  slotId: Id,
  mode: Mode,
  matchReasons: ProposalBase.counsellor.shape.matchReasons,
  disclosure: z.array(DisclosureItem).max(8),
});

export type CheckinSummary = z.infer<typeof CheckinSummary>;
export type AgentRunRequest = z.infer<typeof AgentRunRequest>;
export type DisclosureItem = z.infer<typeof DisclosureItem>;
export type StoredDisclosureItem = z.infer<typeof StoredDisclosureItem>;
export type Proposal = z.infer<typeof Proposal>;
export type StoredProposal = z.infer<typeof StoredProposal>;
export type ConfirmRequest = z.infer<typeof ConfirmRequest>;
export type RunStatus = z.infer<typeof RunStatus>;
export type TraceStep = z.infer<typeof TraceStep>;
export type AgentRunCreated = z.infer<typeof AgentRunCreated>;
export type AgentRunView = z.infer<typeof AgentRunView>;
export type SearchCounsellorsInput = z.infer<typeof SearchCounsellorsInput>;
export type ListOpenSlotsInput = z.infer<typeof ListOpenSlotsInput>;
export type HoldSlotInput = z.infer<typeof HoldSlotInput>;
export type SubmitProposalInput = z.infer<typeof SubmitProposalInput>;
