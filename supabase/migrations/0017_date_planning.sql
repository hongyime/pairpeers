-- PairPeers migration 0017: date planning proposals, venue picker, and slot selection

alter table match_dates add column if not exists proposer_id uuid references profiles(id) on delete set null;
alter table match_dates add column if not exists slot_1 timestamptz;
alter table match_dates add column if not exists slot_2 timestamptz;
alter table match_dates add column if not exists slot_3 timestamptz;
alter table match_dates add column if not exists venue_text text check (char_length(venue_text) <= 200);
alter table match_dates add column if not exists selected_slot timestamptz;
alter table match_dates add column if not exists proposed_at timestamptz;
alter table match_dates add column if not exists selected_at timestamptz;

-- Index for proposer lookups
create index if not exists idx_match_dates_proposer_id on match_dates(proposer_id);
