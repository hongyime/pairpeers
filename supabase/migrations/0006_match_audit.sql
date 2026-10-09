-- PairPeers migration 0006: retain a founder-readable audit for each cycle.
-- The audit is kept on match_cycles so one cycle row is the complete record.
alter table match_cycles add column audit jsonb not null default '{}'::jsonb;

-- Prevent concurrent runner requests from creating two open cycles.
create unique index match_cycles_one_open_idx on match_cycles ((closed_at is null)) where closed_at is null;
