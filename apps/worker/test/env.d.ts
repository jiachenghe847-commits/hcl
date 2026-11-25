import type { D1Migration } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      DEMO_COUNSELLOR_PASSCODE: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
export {};
