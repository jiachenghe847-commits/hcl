/** GET /api/counsellors and GET /api/counsellors/:id/slots (CONTRACTS.md §4). Read-only. */
import { IsoDate } from '@haven/contracts';
import { Hono } from 'hono';
import { requireDevice } from '../auth/device.js';
import type { AppEnv } from '../env.js';
import { ApiError } from '../http/errors.js';
import { getCounsellor, listCounsellors } from './counsellors.js';
import { HORIZON_DAYS, listOpenSlots } from './slots.js';
import { campusDate } from './time.js';

export const catalogRoutes = new Hono<AppEnv>();
catalogRoutes.use('*', requireDevice);

catalogRoutes.get('/', async (c) => c.json(await listCounsellors(c.env.DB)));

catalogRoutes.get('/:id/slots', async (c) => {
  const now = new Date();
  const counsellor = await getCounsellor(c.env.DB, c.req.param('id'));
  if (!counsellor) throw new ApiError('not_found', 'No such counsellor');

  const from = c.req.query('from') ?? campusDate(now);
  const to = c.req.query('to') ?? campusDate(now, HORIZON_DAYS);
  if (!IsoDate.safeParse(from).success || !IsoDate.safeParse(to).success || to < from) {
    throw new ApiError('validation_failed', 'from/to must be YYYY-MM-DD with from <= to');
  }
  return c.json(await listOpenSlots(c.env.DB, now, { counsellorId: counsellor.id, from, to }));
});
