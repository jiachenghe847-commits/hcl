/** Worker bindings (wrangler.jsonc) and per-request Hono variables. */
export interface Env {
  DB: D1Database;
  /** Secret: `.dev.vars` locally, `wrangler secret put` when deployed. */
  DEMO_COUNSELLOR_PASSCODE: string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** sha256(device token), set by requireDevice. The raw token is never stored. */
    ownerHash: string;
  };
}
