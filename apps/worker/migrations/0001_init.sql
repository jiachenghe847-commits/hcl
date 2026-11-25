-- Schema from docs/CONTRACTS.md §3. Change only together with that file.
CREATE TABLE counsellors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  languages TEXT NOT NULL,
  focus_areas TEXT NOT NULL,
  modes TEXT NOT NULL,
  bio TEXT NOT NULL
);

CREATE TABLE slots (
  id TEXT PRIMARY KEY,
  counsellor_id TEXT NOT NULL REFERENCES counsellors(id),
  starts_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 50,
  hold_run_id TEXT,
  hold_expires_at TEXT,
  UNIQUE (counsellor_id, starts_at)
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  ref_code TEXT NOT NULL UNIQUE,
  owner_hash TEXT NOT NULL,
  slot_id TEXT NOT NULL REFERENCES slots(id),
  mode TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  agent_run_id TEXT,
  created_at TEXT NOT NULL,
  cancelled_at TEXT
);
CREATE UNIQUE INDEX one_confirmed_booking_per_slot ON bookings(slot_id) WHERE status = 'confirmed';
CREATE INDEX bookings_by_owner ON bookings(owner_hash, created_at);

CREATE TABLE disclosure_items (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  kind TEXT NOT NULL CHECK (kind IN ('shared', 'generalised')),
  counsellor_text TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX items_by_booking ON disclosure_items(booking_id);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'proposed', 'confirmed', 'cancelled', 'expired', 'failed', 'crisis')),
  proposal TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE agent_steps (
  run_id TEXT NOT NULL REFERENCES agent_runs(id),
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('safety_check', 'llm_turn', 'tool_call', 'tool_result', 'validation', 'error')),
  summary TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, seq)
);
