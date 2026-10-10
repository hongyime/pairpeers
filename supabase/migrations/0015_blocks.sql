-- PairPeers migration 0015: match blocks (global pair exclusion).

create table if not exists match_blocks (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references profiles(id) on delete cascade,
  user_b_id uuid not null references profiles(id) on delete cascade,
  blocked_by uuid not null references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_a_id < user_b_id),
  unique (user_a_id, user_b_id)
);

create index if not exists match_blocks_user_a_idx on match_blocks(user_a_id);
create index if not exists match_blocks_user_b_idx on match_blocks(user_b_id);
create index if not exists match_blocks_blocked_by_idx on match_blocks(blocked_by);

-- Service-role only RLS lockdown
alter table match_blocks enable row level security;
