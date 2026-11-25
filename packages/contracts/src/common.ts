/** Shared vocabularies (CONTRACTS.md §4, §6). Closed sets, so the UI, the server and the LLM tools agree. */
import { z } from 'zod';

export const Locale = z.enum(['en', 'zh']);
export const Role = z.enum(['student', 'staff']);
export const Language = z.enum(['en', 'zh', 'ms']);
export const Mode = z.enum(['in_person', 'video', 'chat']);
export const FocusArea = z.enum([
  'academic_stress',
  'anxiety',
  'low_mood',
  'loneliness',
  'homesickness',
  'relationships',
  'financial_stress',
  'sleep',
  'work_stress',
  'burnout',
]);
export const DisclosureChoice = z.enum(['share', 'generalise', 'withhold']);

/** Opaque server-generated id, e.g. 'c-zhou', 'run_8f3k…'. */
export const Id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
/** Ids the agent assigns to disclosure items within one proposal, e.g. 'd1'. */
export const ItemId = z.string().regex(/^[a-z0-9-]{1,16}$/);

export const IsoDate = z.iso.date();
export const IsoDateTime = z.iso.datetime({ offset: true });

export const ErrorCode = z.enum([
  'unauthorized',
  'not_found',
  'validation_failed',
  'slot_unavailable',
  'hold_expired',
  'crisis_detected',
  'llm_unavailable',
  'rate_limited',
  'conflict',
]);
export const ErrorBody = z.strictObject({
  error: z.strictObject({ code: ErrorCode, message: z.string() }),
});

export type Locale = z.infer<typeof Locale>;
export type Role = z.infer<typeof Role>;
export type Language = z.infer<typeof Language>;
export type Mode = z.infer<typeof Mode>;
export type FocusArea = z.infer<typeof FocusArea>;
export type DisclosureChoice = z.infer<typeof DisclosureChoice>;
export type ErrorCode = z.infer<typeof ErrorCode>;
export type ErrorBody = z.infer<typeof ErrorBody>;
