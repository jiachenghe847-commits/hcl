/**
 * Demo passcode for the counsellor view (DECISIONS.md D4).
 * Fails closed: when the secret is unset, every request is rejected.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.js';
import { ApiError } from '../http/errors.js';

async function digest(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}

export const requireDemoPasscode: MiddlewareHandler<AppEnv> = async (c, next) => {
  const expected = c.env.DEMO_COUNSELLOR_PASSCODE;
  const given = c.req.header('X-Haven-Demo-Passcode');
  if (!expected || !given) throw new ApiError('unauthorized', 'Counsellor passcode required');
  // Hash both sides so lengths match, then compare in constant time.
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  if (!crypto.subtle.timingSafeEqual(a, b)) throw new ApiError('unauthorized', 'Counsellor passcode required');
  await next();
};
