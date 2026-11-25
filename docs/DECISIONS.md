# Decisions

Newest first. Each entry gives the decision and the reason.

## 2026-11-25

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
