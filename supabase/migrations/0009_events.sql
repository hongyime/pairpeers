-- PairPeers migration 0009: append-only events instrumentation for analytics and founder metrics.

create table events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_profile_id uuid references profiles(id) on delete set null,
  match_id uuid references matches(id) on delete set null,
  cycle_id uuid references match_cycles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text unique
);

create index events_event_type_idx on events(event_type);
create index events_actor_profile_id_idx on events(actor_profile_id);
create index events_occurred_at_idx on events(occurred_at);

-- Lock down RLS per migration 0003: no public policies, service role access only.
alter table events enable row level security;
