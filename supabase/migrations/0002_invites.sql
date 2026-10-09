-- PairPeers migration 0002: invite system (business decisions 2026-10-09).
--
-- Decisions encoded: 3 invites per person, non-replenishing; 3-day expiry;
-- strictly single-use codes (max_uses=1); vouch written atomically at invite
-- time (vouch_text on the invite, materialized into vouches on redemption);
-- multiple vouches may attach to one profile (unique pair per voucher);
-- no formal strike system (redemptions table is the audit seed);
-- pool balance monitored, not hard-gated; preview shows inviter + vouch;
-- deep link primary; founder seeds marked explicitly.
--
-- Run with: supabase db push (or paste into the Supabase SQL editor)

-- Membership: only redeemed (or founder-marked) profiles enter the pool.
alter table profiles
  add column is_member boolean not null default false,
  add column is_founder boolean not null default false;

-- Invites: expiry, atomic vouch text, founder-seed marking.
alter table invites
  add column expires_at timestamptz not null default now() + interval '3 days',
  add column vouch_text text,
  add column is_founder_seed boolean not null default false;

-- Redemptions: permanent audit history (code, redeemer, timestamp, IP hash).
-- Private, founder-visible only (RLS tightened before launch).
create table redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  redeemer_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  ip_hash text
);
alter table redemptions enable row level security;
create policy "pilot_open_all" on redemptions for all using (true) with check (true);

-- Atomic redemption: validate, consume, audit, vouch, and grant membership
-- in a single transaction. The row lock (FOR UPDATE) makes double-redemption
-- races impossible: exactly one concurrent attempt can win the uses increment.
create or replace function redeem_invite(p_code text, p_profile_id uuid, p_ip_hash text)
returns jsonb as $$
declare
  v_invite invites%rowtype;
begin
  select * into v_invite from invites where code = p_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if v_invite.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if v_invite.uses >= v_invite.max_uses then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;
  if v_invite.inviter_id = p_profile_id then
    return jsonb_build_object('ok', false, 'error', 'self_redeem');
  end if;

  update invites set uses = uses + 1 where id = v_invite.id;

  insert into redemptions (code, redeemer_profile_id, ip_hash)
  values (p_code, p_profile_id, p_ip_hash);

  -- Materialize the atomic vouch: the inviter's written reference becomes a
  -- vouch row on the vouchee's profile. ON CONFLICT keeps stacking vouches
  -- from *different* vouchers idempotent-safe per (voucher, vouchee).
  if v_invite.vouch_text is not null and v_invite.inviter_id is not null then
    insert into vouches (voucher_id, vouchee_id, text)
    values (v_invite.inviter_id, p_profile_id, v_invite.vouch_text)
    on conflict (voucher_id, vouchee_id) do nothing;
  end if;

  update profiles set is_member = true where id = p_profile_id;

  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;
