-- PairPeers migration 0011: safety operations and member bans.

-- 1. Safety reports table
create table safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references profiles(id) on delete cascade,
  reported_profile_id uuid not null references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  category text not null,
  details text,
  status text not null check (status in ('open', 'reviewing', 'resolved', 'dismissed')) default 'open',
  resolution_notes text,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index safety_reports_status_idx on safety_reports(status);
create index safety_reports_reporter_match_cat_idx on safety_reports(reporter_profile_id, match_id, category);

-- Service-role only RLS lockdown
alter table safety_reports enable row level security;

-- 2. Profiles ban column (ban-only model; reversible via admin)
alter table profiles
  add column if not exists is_banned boolean not null default false;

-- 3. Replace redeem_invite function to reject banned members and invalid invites atomically
create or replace function redeem_invite(p_code text, p_profile_id uuid, p_ip_hash text)
returns jsonb as $$
declare
  v_invite invites%rowtype;
  v_inviter_banned boolean;
  v_redeemer_banned boolean;
begin
  select * into v_invite from invites where code = p_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Banning a profile invalidates their unused invites
  if v_invite.inviter_id is not null then
    select is_banned into v_inviter_banned from profiles where id = v_invite.inviter_id;
    if v_inviter_banned = true then
      return jsonb_build_object('ok', false, 'error', 'banned_code');
    end if;
  end if;

  -- Banned member cannot redeem
  select is_banned into v_redeemer_banned from profiles where id = p_profile_id;
  if v_redeemer_banned = true then
    return jsonb_build_object('ok', false, 'error', 'banned_code');
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

  -- Materialize the atomic vouch
  if v_invite.vouch_text is not null and v_invite.inviter_id is not null then
    insert into vouches (voucher_id, vouchee_id, text)
    values (v_invite.inviter_id, p_profile_id, v_invite.vouch_text)
    on conflict (voucher_id, vouchee_id) do nothing;
  end if;

  update profiles set is_member = true where id = p_profile_id;

  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;
