-- PairPeers migration 0003: lock down Row Level Security.
--
-- The app reads/writes Supabase exclusively server-side with the
-- SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS), and every route is gated
-- by our Telegram session auth. The anon key (shipped in the client bundle)
-- must therefore have NO direct table access.
--
-- APPLY ONLY AFTER SUPABASE_SERVICE_ROLE_KEY is live in Vercel, otherwise
-- the app loses DB access. Run with: supabase db push (tunnel) or SQL editor.

do $$
declare
  t text;
begin
  foreach t in array array['profiles','invites','vouches','questionnaire_responses','match_cycles','matches','redemptions']
  loop
    execute format('drop policy if exists "pilot_open_all" on %I', t);
  end loop;
end $$;

-- No replacement policies: with RLS enabled and zero policies, the anon and
-- authenticated roles are denied all access by default. service_role bypasses
-- RLS entirely, which is the only key the server uses.
