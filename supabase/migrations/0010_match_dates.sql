-- PairPeers migration 0010: match dates scheduling, check-in, and feedback gating.

create table match_dates (
  match_id uuid primary key references matches(id) on delete cascade,
  status text not null check (status in ('not_planned', 'scheduled', 'happened', 'skipped')) default 'not_planned',
  scheduled_at timestamptz,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend match_nudges check constraint to support date check-in nudges
alter table match_nudges drop constraint if exists match_nudges_nudge_type_check;
alter table match_nudges add constraint match_nudges_nudge_type_check check (nudge_type in ('day_7', 'day_14', 'date_checkin'));

-- Service role only RLS lockdown
alter table match_dates enable row level security;
