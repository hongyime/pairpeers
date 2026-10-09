-- PairPeers migration 0005: store the Telegram username.
--
-- The username (t.me/<username>) is how matches contact each other, and it
-- can change — so it is refreshed on every login and by the weekly Telegram
-- profile sync (see /api/admin/sync-telegram).
--
-- Run with: supabase db push (tunnel) or paste into the Supabase SQL editor.

alter table profiles add column telegram_username text;
