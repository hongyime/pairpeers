-- PairPeers migration 0008: private post-acceptance feedback and nudge tracking.

-- match_feedback: post-acceptance private review from participants.
create table match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  would_meet_again boolean not null,
  note text,
  submitted_at timestamptz not null default now(),
  unique (match_id, profile_id)
);

create index match_feedback_match_id_idx on match_feedback(match_id);

-- match_nudges: tracks sent Telegram feedback reminders to prevent duplicates.
create table match_nudges (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  nudge_type text not null check (nudge_type in ('day_7', 'day_14')),
  sent_at timestamptz not null default now(),
  unique (match_id, profile_id, nudge_type)
);

create index match_nudges_match_id_idx on match_nudges(match_id);

-- Lock down RLS per migration 0003: no public policies, service role access only.
alter table match_feedback enable row level security;
alter table match_nudges enable row level security;
