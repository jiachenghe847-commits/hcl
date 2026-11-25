/** Worker bindings (wrangler.jsonc) and per-request Hono variables. */
export interface Env {
  DB: D1Database;
  /** Secret: `.dev.vars` locally, `wrangler secret put` when deployed. */
  DEMO_COUNSELLOR_PASSCODE: string;
  /** 'anthropic' (default). */
  LLM_PROVIDER?: string;
  /** Defaults to claude-opus-5-5. */
  LLM_MODEL?: string;
  /** Secret. Without it the agent answers llm_unavailable. */
  ANTHROPIC_API_KEY?: string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** sha256(device token), set by requireDevice. The raw token is never stored. */
    ownerHash: string;
  };
}
