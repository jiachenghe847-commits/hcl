# Haven Agent: start here

This file is the map. Details live in `docs/`. If chat history and this repo disagree, the repo wins.

## What this is

**Haven** is a campus mental-wellbeing app for students and staff. It has three required modules: daily mood/energy check-in, confidential counsellor booking, and SOS. The project serves two deliverables:

- the SWE203 HCI coursework (report text is written by the team, not by agents);
- the XMUM AI Agent Innovation Competition 2026.

**Haven Agent** is the AI layer. It turns a check-in plus a free-text message into a matched counselling slot. It shares with the counsellor only what the user approves, and the user can revoke any item later. All counsellor and user data is fictional. The competition forbids personal or confidential data.

Hard dates:

- SUS user testing: week of 2026-12-07
- Course submission: 2026-12-14 17:00
- Competition submission: 2026-12-16 (no edits after)
- Live final: 2026-12-20

## Status

Contracts v0 are drafted and **awaiting owner approval**. There is no app code yet.
Update this line whenever a slice lands.

## Map

```
AGENTS.md            this file (keep under ~100 lines)
CLAUDE.md            pointer to this file
docs/CONTRACTS.md    source of truth: module map, D1 schema, HTTP API, agent tools, safety invariants
docs/DECISIONS.md    dated log of decisions and why
docs/reference/      original single-file prototype (UI reference for the port)
apps/web/            React + Vite + TS front end           (planned)
apps/worker/         Cloudflare Worker: /api, agent loop    (planned)
packages/contracts/  zod schemas + types shared by web and worker (planned)
packages/safety/     crisis detector + redaction, pure TS   (planned)
```

Dependency direction is one-way only:

- `web` → `contracts`, `safety`
- `worker` → `contracts`, `safety`
- `contracts` → zod
- `safety` → nothing

Nothing imports from `apps/*`.

## Rules

1. **Ask the owner first** before changing architecture, the D1 schema, the public HTTP API, auth, deployment, or LLM provider defaults. Record each decision in `docs/DECISIONS.md`.
2. **Keep safety invariants S1–S7** (`docs/CONTRACTS.md` §7). Each one has a named test. Never weaken an invariant to make a test pass.
3. **Side effects fail closed.** If state is not confirmed (hold expired, consent missing, budget unknown), do nothing and return an error.
4. **Organise by feature.** Use folders such as `features/booking/`. Do not create `utils/`, `helpers/` or `common/` dumping grounds.
5. **Watch file size.** A file over ~400 lines means you should check whether it still has one job.
6. **Justify abstractions.** A new layer needs a stated benefit in its doc comment or in DECISIONS.md.
7. **No secrets or real data.** Secrets go in `.dev.vars` (gitignored) or `wrangler secret`. Never add real names, IDs or case data.

## Workflow

1. Settle the contract.
2. Cut one small slice.
3. Implement it.
4. Test it.
5. Commit, one slice per commit.

Before a large change, list its blast radius (files, endpoints, tables) in the commit message. If your context gets messy, stop and hand over through this file and `docs/`.

## Verify

Commands are defined once the scaffold lands. Expected: `npm test`, `npm run typecheck`, `npm run dev`.

When you report work, state the level you verified:

- compiles
- unit
- integration (worker + D1 local)
- deployed
- user scenario

Tests are the spec. Cover edge cases, and for every side effect ask what happens if it runs twice.

## Where to look

| Task | Start at |
|---|---|
| Change what the agent may do | `docs/CONTRACTS.md` §6, then `apps/worker/src/agent/` |
| Change booking rules | `docs/CONTRACTS.md` §3–5, then `apps/worker/src/booking/` |
| Crisis / SOS behaviour | `docs/CONTRACTS.md` §7, then `packages/safety/` |
| Port a screen from the old prototype | `docs/reference/prototype-v1.html`, then `apps/web/src/features/` |
