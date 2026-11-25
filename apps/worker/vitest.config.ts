import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        // Tests are hermetic: no LLM regardless of .dev.vars (agent tests inject their own provider).
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, DEMO_COUNSELLOR_PASSCODE: 'test-passcode', LLM_PROVIDER: 'none' } },
      }),
    ],
    test: { setupFiles: ['./test/apply-migrations.ts'] },
  };
});
