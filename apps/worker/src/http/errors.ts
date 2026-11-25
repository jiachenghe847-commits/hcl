/** HTTP error shape and request parsing (CONTRACTS.md §4). Every failure leaves the worker as an ErrorBody. */
import type { ErrorBody, ErrorCode } from '@haven/contracts';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  unauthorized: 401,
  not_found: 404,
  validation_failed: 400,
  slot_unavailable: 409,
  hold_expired: 409,
  crisis_detected: 409,
  llm_unavailable: 503,
  rate_limited: 429,
  conflict: 409,
  internal: 500,
};

export function errorResponse(c: Context, err: unknown): Response {
  if (err instanceof ApiError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    return c.json(body, STATUS[err.code]);
  }
  console.error('unhandled error', err);
  const body: ErrorBody = { error: { code: 'internal', message: 'Something went wrong. Nothing was changed.' } };
  return c.json(body, 500);
}

export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError('validation_failed', 'Body must be JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError('validation_failed', first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid body');
  }
  return parsed.data;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

/** Required on every creating POST, so a double tap returns the same result (S5). */
export function requireIdempotencyKey(c: Context): string {
  const key = c.req.header('Idempotency-Key');
  if (!key || !IDEMPOTENCY_KEY.test(key)) {
    throw new ApiError('validation_failed', 'Idempotency-Key header (8–128 chars, A-Z a-z 0-9 _ -) is required');
  }
  return key;
}
