/** Worker entry: mounts each feature's routes under /api. Feature logic lives in its folder, not here. */
import { Hono } from 'hono';
import { bookingRoutes } from './booking/routes.js';
import { catalogRoutes } from './catalog/routes.js';
import { counsellorViewRoutes } from './counsellor-view/routes.js';
import type { AppEnv } from './env.js';
import { ApiError, errorResponse } from './http/errors.js';

const app = new Hono<AppEnv>().basePath('/api');

app.get('/health', (c) => c.json({ ok: true }));
app.route('/counsellors', catalogRoutes);
app.route('/bookings', bookingRoutes);
app.route('/counsellor', counsellorViewRoutes);

app.notFound((c) => errorResponse(c, new ApiError('not_found', 'No such endpoint')));
app.onError((err, c) => errorResponse(c, err));

export default app;
