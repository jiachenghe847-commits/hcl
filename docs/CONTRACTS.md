# Contracts v1.1 (v1 approved by owner 2026-11-25; v1.1 adds error code `internal`)

This file is the source of truth. Code and tests must match it. To change it, ask the owner first (AGENTS.md rule 1), then bump the version.

## 1. Modules

| Module | Job | May import |
|---|---|---|
| `packages/safety` | Crisis detection and identifier redaction. Pure functions, same code on device and server. | nothing |
| `packages/contracts` | Zod schemas and TS types for every HTTP body and agent tool input/output. | zod |
| `apps/worker` | HTTP API, D1 access, agent loop, LLM adapters. Feature folders: `booking/`, `agent/`, `llm/`, `counsellor-view/`, `db/` (migrations + seed). | contracts, safety |
| `apps/web` | React UI, ported from the prototype. Feature folders: `onboarding/`, `checkin/`, `booking/`, `sos/`, `agent/`, `counsellor-view/`, `me/`. Local storage for check-ins. | contracts, safety |

## 2. Where data lives

| Data | Device (localStorage) | Server (D1) | Sent to LLM |
|---|---|---|---|
| Check-ins (mood, energy, tags) | yes | no | summary of the last 14 days only |
| Private note / free-text message | yes | **never stored** | only after client redaction |
| Device token | yes | `sha256` only | no |
| Disclosure items the user approved | copy | yes | no |
| Withheld items | yes | **never** | no |
| Counsellors, slots (fictional seed) | no | yes | via tools |
| Agent action trace | no | yes, redacted, 24 h retention (Q1) | n/a |

## 3. D1 schema

```sql
CREATE TABLE counsellors (
  id TEXT PRIMARY KEY,               -- 'c-zhou'; fictional people only
  display_name TEXT NOT NULL,
  languages TEXT NOT NULL,           -- JSON array: 'en' | 'zh' | 'ms'
  focus_areas TEXT NOT NULL,         -- JSON array of FocusArea (§6)
  modes TEXT NOT NULL,               -- JSON array: 'in_person' | 'video' | 'chat'
  bio TEXT NOT NULL
);

CREATE TABLE slots (
  id TEXT PRIMARY KEY,
  counsellor_id TEXT NOT NULL REFERENCES counsellors(id),
  starts_at TEXT NOT NULL,           -- ISO 8601 with +08:00
  duration_min INTEGER NOT NULL DEFAULT 50,
  hold_run_id TEXT,                  -- agent run currently holding it
  hold_expires_at TEXT,              -- hold valid while > now
  UNIQUE (counsellor_id, starts_at)
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  ref_code TEXT NOT NULL UNIQUE,     -- shown instead of a name, e.g. 'HV-7K2Q'
  owner_hash TEXT NOT NULL,          -- sha256(device token)
  slot_id TEXT NOT NULL REFERENCES slots(id),
  mode TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  agent_run_id TEXT,                 -- null for manual bookings
  created_at TEXT NOT NULL,
  cancelled_at TEXT
);
CREATE UNIQUE INDEX one_confirmed_booking_per_slot ON bookings(slot_id) WHERE status = 'confirmed';

CREATE TABLE disclosure_items (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  kind TEXT NOT NULL CHECK (kind IN ('shared', 'generalised')),
  counsellor_text TEXT NOT NULL,     -- exactly what the counsellor sees
  revoked_at TEXT
);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'proposed', 'confirmed', 'cancelled', 'expired', 'failed', 'crisis')),
  proposal TEXT,                     -- JSON StoredProposal (no user-side labels)
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL           -- created_at + 10 min
);

CREATE TABLE agent_steps (
  run_id TEXT NOT NULL REFERENCES agent_runs(id),
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('safety_check', 'llm_turn', 'tool_call', 'tool_result', 'validation', 'error')),
  summary TEXT NOT NULL,             -- one line for the action-trace panel
  detail TEXT,                       -- JSON, redacted
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, seq)
);
```

Slot state is derived, not stored:

- A slot is **booked** if a confirmed booking references it.
- A slot is **held** if `hold_expires_at` is later than now.
- Otherwise it is **open**.

## 4. HTTP API

All bodies are JSON. Errors use this shape:

```json
{"error": {"code": "...", "message": "..."}}
```

Error codes: `unauthorized`, `not_found`, `validation_failed`, `slot_unavailable`, `hold_expired`, `crisis_detected`, `llm_unavailable`, `rate_limited`, `conflict`, `internal` (unexpected failure, nothing changed; added in v1.1).

Auth headers:

- **Device**: `X-Haven-Device` carries a random token of at least 32 bytes, base64url-encoded.
- **Counsellor**: `X-Haven-Demo-Passcode`, compared in constant time with the `DEMO_COUNSELLOR_PASSCODE` secret.

| Method + path | Auth | Side effect | Twice = |
|---|---|---|---|
| `GET /api/health` | none | none | same |
| `GET /api/counsellors` | device | none | same |
| `GET /api/counsellors/:id/slots?from&to` | device | none | same |
| `POST /api/agent/runs` (`Idempotency-Key`) | device | creates run; may hold 1 slot. A crisis run returns `201` with status `crisis` (no LLM call). | same run returned, as the stored view without `userLabel` |
| `GET /api/agent/runs/:id` | owner | none; returns status, trace and the stored proposal, **without** `userLabel` (only the create response has it) | same |
| `POST /api/agent/runs/:id/confirm` | owner | creates booking + items, clears hold | same booking returned |
| `POST /api/agent/runs/:id/cancel` | owner | releases hold | no-op |
| `POST /api/bookings` (`Idempotency-Key`) | device | manual booking, the fallback when the LLM is down | same booking |
| `GET /api/bookings` | device | none | same |
| `POST /api/bookings/:id/cancel` | owner | status → cancelled | no-op |
| `POST /api/bookings/:id/items/:itemId/revoke` | owner | sets `revoked_at` | no-op |
| `GET /api/counsellor/:counsellorId/bookings` | passcode | none; returns confirmed bookings, `ref_code` and **non-revoked** items only, never `owner_hash` | same |

Request and response shapes live in `packages/contracts`. The key shapes are:

```ts
AgentRunRequest = {
  locale: 'en' | 'zh';
  role: 'student' | 'staff';
  checkins: { date: string; mood: 1|2|3|4|5; energy: 1|2|3|4|5; tags: string[] }[]; // ≤ 14, no notes
  message?: string;                 // ≤ 1000 chars, already redacted on device
  preferences?: { languages?: string[]; modes?: string[]; availability?: string /* ≤ 200 chars */ };
}

Proposal = {
  summary: string;                                  // 1–2 sentences, user-facing
  counsellor: { id: string; displayName: string; matchReasons: string[] };
  slot: { id: string; startsAt: string; mode: string; holdExpiresAt: string };
  disclosure: {
    itemId: string;
    choice: 'share' | 'generalise' | 'withhold';
    counsellorText: string | null;                  // null when withhold
    userLabel: string;                              // shown to the user only; not stored on server
    reason: string;
  }[];
}

ConfirmRequest = {
  decisions: { itemId: string; choice: 'share' | 'generalise' | 'withhold'; editedText?: string }[];
}
```

## 5. Agent run lifecycle

1. **Create.** `POST /agent/runs` starts a run.
   - The server runs the crisis detector first. On a hit, status becomes `crisis` and **no LLM call is made**.
   - Otherwise the LLM loop runs. Limits: at most 8 tool calls and a 30 s wall clock.
2. **Loop outcome.** The loop ends with exactly one of:
   - `proposed`: exactly one slot is held by this run.
   - `failed`: no hold is left behind.
3. **Confirm.** `confirm` runs in one D1 transaction (batch) and succeeds only if all of these hold:
   - the run is `proposed`;
   - the hold belongs to this run and has not expired;
   - the slot is not booked;
   - every shared or generalised text passes the validator.

   On success it inserts the booking and its items, then clears the hold. If any check fails, it writes nothing and returns `hold_expired`, `slot_unavailable` or `validation_failed`.
4. **Cancel or expire.** `cancel`, or reaching `expires_at`, moves the run to `cancelled` or `expired` and releases the hold.

**The LLM never books.** Booking is deterministic server code that runs after explicit user consent.

## 6. Agent tools (LLM-facing)

`FocusArea` is one of:

- `academic_stress`
- `anxiety`
- `low_mood`
- `loneliness`
- `homesickness`
- `relationships`
- `financial_stress`
- `sleep`
- `work_stress`
- `burnout`

| Tool | Input | Effect | Rules |
|---|---|---|---|
| `search_counsellors` | `{ language?, focusArea?, mode? }` | read | returns ≤ 5 |
| `list_open_slots` | `{ counsellorId, from, to }` | read | ≤ 10 open slots, within 14 days |
| `hold_slot` | `{ slotId }` | hold for 10 min | one hold per run (a new hold releases the old one); same slot again → same hold |
| `submit_proposal` | Proposal minus `holdExpiresAt` | ends the loop | the server checks the hold, runs the validator, and forces failing items to `withhold` |

Every tool call and result is written to `agent_steps`, redacted. That table is the action trace the UI shows.

## 7. Safety invariants (each needs a test of the same id)

- **S1 SOS needs no LLM and no network.** The client detector plus the static SOS screen work offline.
- **S2 The server re-checks for crisis before any LLM call.** On a hit: no LLM call, status `crisis`.
- **S3 Raw notes never leave the device unredacted and are never stored server-side.**
- **S4 Counsellor endpoints only ever return non-revoked items of confirmed bookings.** This is enforced in the SQL query, not in the prompt.
- **S5 A booking exists only via manual booking or confirm with a valid hold.** Both are idempotent by key.
- **S6 Cancel and revoke are idempotent.** Running either twice changes nothing more.
- **S7 Approved text is validated before storage.** The server checks every approved text for a phone number, email address, or student/staff ID pattern. On a match, that item is downgraded to `withhold`.
  The device runs the same check plus the user's own do-not-share names. That list never leaves the device.

## 8. Settled questions (approved 2026-11-25 as proposed)

- **Q1** How long should agent runs and traces be kept? Proposed: 24 h, deleted by a cron trigger.
- **Q2** What rate limits apply? The URL is public and calls cost money. Proposed: 20 runs per device per day and 300 runs per day globally. Requests fail closed with `rate_limited`.
- **Q3** Which language for repo docs and code comments? Proposed: English. The UI stays bilingual (EN/中文).
- **Q4** Where is the repo hosted, and who can access it? For example, a private GitHub repo for the 5 team members.
