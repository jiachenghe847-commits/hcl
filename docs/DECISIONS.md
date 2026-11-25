# Decisions

Newest first. Each entry gives the decision and the reason.

## 2026-11-26

**D11: DeepSeek adapter (`LLM_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`, default model `deepseek-flash`).**
The owner provided a DeepSeek key. The adapter (`apps/worker/src/llm/deepseek.ts`) uses plain fetch against the OpenAI-style Chat Completions API (docs read 2026-11-26).
- Thinking mode stays on, so each assistant message, including `reasoning_content`, is replayed verbatim.
- Invalid tool-call JSON becomes a rejected call that the model can correct.

First real runs (local, fictional text): EN and ZH proposals took 9–16 s, used 5 tool calls, and cost well under 1 cent each. After prompt tuning, money and family details are withheld by default, and counsellor texts are short third-person themes.

Open points for the owner:
- Whether production uses DeepSeek.
- DeepSeek's docs do not state API data retention or training use. Only fictional data may be entered (PNC rule), and this is a Q&A point for judges.
- The Anthropic adapter (D9) remains available.


**D10: A dev/demo-only scripted provider (`LLM_PROVIDER=scripted`, file `apps/worker/src/llm/scripted.ts`).**
It is a rule-based stand-in that drives the same tools, loop and server checks as a real model.
- It is never the default. The UI labels it "Demo assistant: a rule-based script, not an AI model" when `/api/health` reports `agentMode: "scripted"`.
- Its counsellor-facing texts are fixed theme phrases, never the user's words.
- Worker tests force `LLM_PROVIDER=none` so they never depend on `.dev.vars`.

Why: the owner asked to build and test the agent screens before buying an API key. It also gives SUS testing a working fallback.
Honest limit: the competition requires a functional AI agent, so the submitted demo should run on the real model (D9). The script is not a substitute.

## 2026-11-25

**D9: Settings for the Anthropic adapter (`apps/worker/src/llm/anthropic.ts`).**
- Model `claude-opus-5-5`, overridable with `LLM_MODEL`. Adaptive thinking runs at effort `medium`.
- Server-side refusal fallbacks are on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). If a turn is declined, the API retries it on a fallback model instead of failing the run.
- Automatic prompt caching is on, so the loop's growing prefix is reused across turns.
- The agent time limit rises from 30 s to 60 s (contracts v1.2).

Why: multi-step tool use benefits from thinking, and `medium` keeps latency and cost reasonable within the RM150 budget. Fallbacks avoid dead-ends on safety-adjacent mental-health wording.
Flagged to the owner: model, effort, fallbacks and the 60 s limit.

**D8: Contracts v1.1 adds the error code `internal` (HTTP 500).**
It means an unexpected failure where nothing was changed.
Why: v1 had no honest code for unexpected errors. Flagged to the owner for review.

**D7: The worker uses Hono for routing, and Vitest runs inside workerd via `@cloudflare/vitest-plugin`.**
Why:
- Hono gives per-feature routers and middleware (device auth, passcode) in very little code, and it is well known.
- The plugin runs tests against real D1 (SQLite) with our migrations, so SQL-level invariants like S4 are tested for real.
- The worker's `compatibility_date` is pinned to 2026-08-15, because the installed workerd supports up to 2026-08-22.

**D6: Run our own agent loop on the Messages API, not a hosted agent service.**
Why:
- Tools must read and write our D1 database.
- The booking step must be deterministic server code.
- The owner wants the LLM provider to be switchable (D3).

**D5: Check-ins and raw notes stay on the device.**
The server receives only:
- mood/energy/tag summaries;
- a message already redacted on the client;
- disclosure items the user approved.

Why: this is the core privacy promise of Haven, and it shrinks what could ever leak.

**D4: Identity is an anonymous device token, and the counsellor view uses a demo passcode.**
No accounts. The server stores only `sha256(token)`.
Why: the product sells anonymous help-seeking, and the data is fictional.

**D3: The LLM provider sits behind a small interface, with the Anthropic adapter built first.**
- Provider and model are chosen through env vars `LLM_PROVIDER` and `LLM_MODEL`.
- The default model is `claude-opus-5-5`.

Why: the owner asked for switchability. One interface lets us swap vendors without touching the agent loop.

**D2: Deploy on Cloudflare Workers + D1, with Workers Static Assets serving the web app.**
Why:
- One URL serves the SUS testers, the judges, and both demo devices.
- The student view and the counsellor view share one database.

**D1: The front end is React + Vite + TypeScript.**
The original `docs/reference/prototype-v1.html` is ported screen by screen.
Why: the owner chose it, and components make the new agent screens easier to build.
