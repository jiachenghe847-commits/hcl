/** /api/agent/runs endpoints (CONTRACTS.md §4–5). */
import { AgentRunRequest, ConfirmRequest } from '@haven/contracts';
import { Hono } from 'hono';
import { requireDevice } from '../auth/device.js';
import type { AppEnv } from '../env.js';
import { readJson, requireIdempotencyKey } from '../http/errors.js';
import { providerFromEnv } from '../llm/index.js';
import { cancelRun, confirmRun, createRun, getRunView } from './service.js';

export const agentRoutes = new Hono<AppEnv>();
agentRoutes.use('*', requireDevice);

agentRoutes.post('/runs', async (c) => {
  const idempotencyKey = requireIdempotencyKey(c);
  const request = await readJson(c, AgentRunRequest);
  const { run, replayed } = await createRun({
    db: c.env.DB,
    provider: providerFromEnv(c.env),
    ownerHash: c.get('ownerHash'),
    idempotencyKey,
    request,
    now: new Date(),
  });
  return c.json(run, replayed ? 200 : 201);
});

agentRoutes.get('/runs/:id', async (c) => c.json(await getRunView(c.env.DB, c.req.param('id'), c.get('ownerHash'), new Date())));

agentRoutes.post('/runs/:id/confirm', async (c) => {
  const body = await readJson(c, ConfirmRequest);
  return c.json(await confirmRun(c.env.DB, c.req.param('id'), c.get('ownerHash'), body, new Date()));
});

agentRoutes.post('/runs/:id/cancel', async (c) => c.json(await cancelRun(c.env.DB, c.req.param('id'), c.get('ownerHash'), new Date())));
