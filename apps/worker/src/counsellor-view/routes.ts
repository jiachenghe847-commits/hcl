/** GET /api/counsellor/:counsellorId/bookings, behind the demo passcode. The S4 filter lives in listCounsellorBookings. */
import { Hono } from 'hono';
import { requireDemoPasscode } from '../auth/passcode.js';
import { listCounsellorBookings } from '../booking/views.js';
import { getCounsellor } from '../catalog/counsellors.js';
import type { AppEnv } from '../env.js';
import { ApiError } from '../http/errors.js';

export const counsellorViewRoutes = new Hono<AppEnv>();
counsellorViewRoutes.use('*', requireDemoPasscode);

counsellorViewRoutes.get('/:counsellorId/bookings', async (c) => {
  const counsellor = await getCounsellor(c.env.DB, c.req.param('counsellorId'));
  if (!counsellor) throw new ApiError('not_found', 'No such counsellor');
  return c.json(await listCounsellorBookings(c.env.DB, counsellor.id));
});
