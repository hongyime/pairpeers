-- PairPeers initial schema.
-- Run with: supabase db push  (or paste into the Supabase SQL editor)

-- Profiles: one row per verified user.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Invites: invite codes issued by existing members. The inviter's
-- reputation is tied to who they bring in (private accountability ledger).
create table invites (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  inviter_id uuid references profiles(id) on delete set null,
  max_uses int not null default 1,
  uses int not null default 0,
  created_at timestamptz not null default now()
);

-- Vouches: friend-written references. The hype text is shown on the
-- vouchee's profile; the voucher link stays queryable for accountability.
create table vouches (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references profiles(id) on delete cascade,
  vouchee_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  unique (voucher_id, vouchee_id)
);

-- Questionnaire answers, one row per profile (upsert on profile_id).
create table questionnaire_responses (
  profile_id uuid primary key references profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Matching cycles: one run of the Gale-Shapley matcher per cycle.
create table match_cycles (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Matches produced by a cycle. status: pending | accepted | declined | expired.
create table matches (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references match_cycles(id) on delete cascade,
  a_id uuid not null references profiles(id) on delete cascade,
  b_id uuid not null references profiles(id) on delete cascade,
  a_score float,
  b_score float,
  status text not null default 'pending',
  check (a_id <> b_id)
);

-- Row Level Security: permissive for the pilot, TIGHTEN BEFORE LAUNCH.
-- TODO: restrict profiles to self + matched partner; invites to inviter;
-- vouches readable by the vouchee and their matches only; matches visible
-- to the two participants; questionnaire_responses owner-only.
alter table profiles enable row level security;
alter table invites enable row level security;
alter table vouches enable row level security;
alter table questionnaire_responses enable row level security;
alter table match_cycles enable row level security;
alter table matches enable row level security;

create policy "pilot_open_all" on profiles for all using (true) with check (true);
create policy "pilot_open_all" on invites for all using (true) with check (true);
create policy "pilot_open_all" on vouches for all using (true) with check (true);
create policy "pilot_open_all" on questionnaire_responses for all using (true) with check (true);
create policy "pilot_open_all" on match_cycles for all using (true) with check (true);
create policy "pilot_open_all" on matches for all using (true) with check (true);
