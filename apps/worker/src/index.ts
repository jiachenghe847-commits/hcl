/** Worker entry: mounts each feature's routes under /api. Feature logic lives in its folder, not here. */
import { Hono } from 'hono';
import { agentRoutes } from './agent/routes.js';
import { deleteOldRuns } from './agent/runs.js';
import { bookingRoutes } from './booking/routes.js';
import { catalogRoutes } from './catalog/routes.js';
import { counsellorViewRoutes } from './counsellor-view/routes.js';
import type { AppEnv, Env } from './env.js';
import { ApiError, errorResponse } from './http/errors.js';
import { agentMode } from './llm/index.js';

const app = new Hono<AppEnv>().basePath('/api');

app.get('/health', (c) => c.json({ ok: true, agentMode: agentMode(c.env) }));
app.route('/counsellors', catalogRoutes);
app.route('/bookings', bookingRoutes);
app.route('/counsellor', counsellorViewRoutes);
app.route('/agent', agentRoutes);

app.notFound((c) => errorResponse(c, new ApiError('not_found', 'No such endpoint')));
app.onError((err, c) => errorResponse(c, err));

export default {
  fetch: app.fetch,
  /** Hourly cron (wrangler.jsonc): Q1 retention, runs and traces older than 24 h are deleted. */
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(deleteOldRuns(env.DB, new Date()));
  },
} satisfies ExportedHandler<Env>;
