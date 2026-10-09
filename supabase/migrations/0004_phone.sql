-- PairPeers migration 0004: store the verified Telegram phone number.
--
-- The `phone` login scope returns the user's number (E.164) in the id_token.
-- Stored for future contact features; never overwritten once set.
-- NOTE: phone numbers are sensitive — keep the RLS lockdown (0003) ahead of
-- real users.
--
-- Run with: supabase db push (tunnel) or paste into the Supabase SQL editor.

alter table profiles add column phone_e164 text;
