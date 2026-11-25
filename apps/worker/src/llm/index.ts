/**
 * Chooses the LLM provider from env (DECISIONS.md D3).
 * Returns null when it is not configured. Callers then fail closed with llm_unavailable,
 * and the manual booking path still works.
 */
import type { Env } from '../env.js';
import type { LlmProvider } from './provider.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export function providerFromEnv(env: Env): LlmProvider | null {
  const name = env.LLM_PROVIDER ?? 'anthropic';
  switch (name) {
    case 'anthropic':
      return null; // adapter lands in the next slice
    default:
      return null;
  }
}
