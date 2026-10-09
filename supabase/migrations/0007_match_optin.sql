-- PairPeers migration 0007: track per-member match opt-in acceptance.

-- match_responses: records each participant's explicit response (accepted | declined).
create table match_responses (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  response text not null check (response in ('accepted', 'declined')),
  responded_at timestamptz not null default now(),
  unique (match_id, profile_id)
);

create index match_responses_match_id_idx on match_responses(match_id);

-- Track when both participants accepted to calculate feedback nudge timings.
alter table matches add column accepted_at timestamptz;

-- Lock down RLS per migration 0003: no public policies, service role access only.
alter table match_responses enable row level security;
