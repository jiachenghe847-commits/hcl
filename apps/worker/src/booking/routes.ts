/** /api/bookings endpoints (CONTRACTS.md §4). Owner-only; another device's booking answers not_found. */
import { ManualBookingRequest } from '@haven/contracts';
import { Hono } from 'hono';
import { requireDevice } from '../auth/device.js';
import type { AppEnv } from '../env.js';
import { readJson, requireIdempotencyKey } from '../http/errors.js';
import { cancelBooking, createManualBooking, revokeItem } from './commands.js';
import { listOwnedBookings } from './views.js';

export const bookingRoutes = new Hono<AppEnv>();
bookingRoutes.use('*', requireDevice);

bookingRoutes.post('/', async (c) => {
  const key = requireIdempotencyKey(c);
  const body = await readJson(c, ManualBookingRequest);
  const { booking, replayed } = await createManualBooking(c.env.DB, c.get('ownerHash'), key, body, new Date());
  return c.json(booking, replayed ? 200 : 201);
});

bookingRoutes.get('/', async (c) => c.json(await listOwnedBookings(c.env.DB, c.get('ownerHash'))));

bookingRoutes.post('/:id/cancel', async (c) =>
  c.json(await cancelBooking(c.env.DB, c.get('ownerHash'), c.req.param('id'), new Date())),
);

bookingRoutes.post('/:id/items/:itemId/revoke', async (c) =>
  c.json(await revokeItem(c.env.DB, c.get('ownerHash'), c.req.param('id'), c.req.param('itemId'), new Date())),
);
