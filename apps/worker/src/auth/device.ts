/**
 * Anonymous device identity (DECISIONS.md D4).
 * The client keeps a random token. The server only ever sees and stores its sha256 hash.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.js';
import { ApiError } from '../http/errors.js';

/** base64url of at least 32 random bytes is 43+ characters. */
const DEVICE_TOKEN = /^[A-Za-z0-9_-]{43,128}$/;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const requireDevice: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = c.req.header('X-Haven-Device');
  if (!token || !DEVICE_TOKEN.test(token)) {
    throw new ApiError('unauthorized', 'Missing or malformed X-Haven-Device token');
  }
  c.set('ownerHash', await sha256Hex(token));
  await next();
};
