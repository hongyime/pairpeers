-- PairPeers migration 0016: safety appeals.

create table if not exists safety_appeals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  safety_report_id uuid references safety_reports(id) on delete set null,
  match_block_id uuid references match_blocks(id) on delete set null,
  reason text not null,
  details text,
  status text not null check (status in ('pending', 'reviewing', 'approved', 'rejected')) default 'pending',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists safety_appeals_status_idx on safety_appeals(status);
create index if not exists safety_appeals_profile_idx on safety_appeals(profile_id);

-- Service-role only RLS lockdown
alter table safety_appeals enable row level security;
