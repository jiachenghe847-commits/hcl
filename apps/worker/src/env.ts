/** Worker bindings (wrangler.jsonc) and per-request Hono variables. */
export interface Env {
  DB: D1Database;
  /** Secret: `.dev.vars` locally, `wrangler secret put` when deployed. */
  DEMO_COUNSELLOR_PASSCODE: string;
  /** 'anthropic' (default), 'deepseek', or 'scripted' (dev/demo only). */
  LLM_PROVIDER?: string;
  /** Defaults per provider: claude-opus-5-5 (anthropic), deepseek-flash (deepseek). */
  LLM_MODEL?: string;
  /** Secret. Without it the agent answers llm_unavailable. */
  ANTHROPIC_API_KEY?: string;
  /** Secret, used when LLM_PROVIDER=deepseek. */
  DEEPSEEK_API_KEY?: string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** sha256(device token), set by requireDevice. The raw token is never stored. */
    ownerHash: string;
  };
}
