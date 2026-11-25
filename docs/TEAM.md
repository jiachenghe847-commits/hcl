# Team guide · 组员指南

How group members work on Haven. Agents start from `AGENTS.md` instead.

**What to work on:** [TASKS.md](TASKS.md) (task board: open tasks, untested gaps, owners, deadlines).

## First time setup · 第一次配置

1. Install **Node.js 22** and **Git**.
2. Clone the repo:

   ```bash
   git clone https://github.com/jiachenghe847-commits/hcl.git
   cd hcl
   npm install
   ```

3. Create `apps/worker/.dev.vars`. This file is never committed.

   ```
   DEMO_COUNSELLOR_PASSCODE=local-demo
   LLM_PROVIDER=scripted
   ```

   `scripted` is the free, rule-based demo assistant. **Do not put the real DeepSeek key in chat, the repo or screenshots.** Only the owner's machine and the live site hold it.

4. Run the app. Use two terminals:

   ```bash
   cd apps/worker
   npx wrangler d1 migrations apply haven --local
   npm run dev
   ```

   ```bash
   cd apps/web
   npm run dev
   ```

   Open http://localhost:5173.

## Making a change · 修改流程

1. Create a branch:

   ```bash
   git switch -c <your-name>/<what>
   ```

   For example: `lin/sus-tasks`.

2. Make the change.
3. Run the checks:

   ```bash
   npm run typecheck
   npm test
   ```

4. Push and open a Pull Request on GitHub. CI runs the same checks. A PR is merged only when CI is green.
5. Only the owner deploys, with `npm run deploy`, so two people never overwrite each other's release.

## Where small changes live · 常见修改位置

| What | File |
|---|---|
| App text, English and 中文 | `apps/web/src/app/i18n.ts` |
| Usability-test tasks (keep in sync with the SUS form) | `apps/web/src/features/study/tasks.ts` and `i18n.ts` (`task1`…`task5`) |
| Fictional counsellors | `apps/worker/migrations/0002_seed_counsellors.sql`. This needs a new migration file, so ask first. |
| Crisis phrases | `packages/safety/src/crisis.ts`, together with `crisis.test.ts` |
| Agent instructions | `apps/worker/src/agent/prompt.ts` |

## Rules that protect users · 必须遵守

- Use only fictional data. Never enter real names, student IDs or real feelings into the app or tests. The competition forbids it (PNC), and the live site sends text to an AI provider.
- Never weaken the safety rules S1–S7 (`docs/CONTRACTS.md` §7). If a test fails, fix the code, not the test.
- Ask the owner before changing the database schema, the API, login or deployment.
- The course report text is written by the team, not by AI.
