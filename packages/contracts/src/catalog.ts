/** Counsellors and slots as the API returns them (CONTRACTS.md §3–4). All counsellors are fictional. */
import { z } from 'zod';
import { FocusArea, Id, IsoDateTime, Language, Mode } from './common.js';

export const Counsellor = z.strictObject({
  id: Id,
  displayName: z.string().min(1),
  languages: z.array(Language).min(1),
  focusAreas: z.array(FocusArea).min(1),
  modes: z.array(Mode).min(1),
  bio: z.string(),
});

export const Slot = z.strictObject({
  id: Id,
  counsellorId: Id,
  startsAt: IsoDateTime,
  durationMin: z.int().positive(),
});

export type Counsellor = z.infer<typeof Counsellor>;
export type Slot = z.infer<typeof Slot>;
