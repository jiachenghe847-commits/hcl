/**
 * Chooses the LLM provider from env (DECISIONS.md D3).
 * Returns null when it is not configured. Callers then fail closed with llm_unavailable,
 * and the manual booking path still works.
 * To add a vendor: implement LlmProvider in a new file here and add a case below.
 */
import type { Env } from '../env.js';
import { AnthropicProvider } from './anthropic.js';
import type { LlmProvider } from './provider.js';
import { ScriptedProvider } from './scripted.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export function providerFromEnv(env: Env): LlmProvider | null {
  switch (env.LLM_PROVIDER ?? 'anthropic') {
    case 'anthropic':
      return env.ANTHROPIC_API_KEY ? new AnthropicProvider(env.ANTHROPIC_API_KEY, env.LLM_MODEL ?? DEFAULT_MODEL) : null;
    case 'scripted':
      return new ScriptedProvider(); // dev/demo only: never the default
    default:
      return null;
  }
}

/** What the UI should say about the assistant: real model, demo script, or unavailable. */
export function agentMode(env: Env): 'llm' | 'scripted' | 'none' {
  const p = providerFromEnv(env);
  return !p ? 'none' : p.name === 'scripted' ? 'scripted' : 'llm';
}
