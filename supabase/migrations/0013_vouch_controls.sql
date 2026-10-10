-- PairPeers migration 0013: vouch consent and controls.

-- 1. Extend vouches with relationship label, name approval consent, and hide/remove timestamps
alter table vouches
  add column if not exists relationship_label text,
  add column if not exists voucher_name_approved boolean not null default false,
  add column if not exists hidden_at timestamptz,
  add column if not exists removed_at timestamptz;

-- 2. Indexes for vouchee and voucher lookups
create index if not exists vouches_vouchee_id_idx on vouches(vouchee_id);
create index if not exists vouches_voucher_id_idx on vouches(voucher_id);
create index if not exists vouches_visibility_idx on vouches(vouchee_id, hidden_at, removed_at);

-- Ensure service-role only RLS lockdown
alter table vouches enable row level security;

-- 3. Extend invites table to capture relationship label and voucher name consent at invite creation
alter table invites
  add column if not exists relationship_label text,
  add column if not exists voucher_name_approved boolean not null default false;

-- 4. Update atomic redeem_invite to propagate relationship_label and voucher_name_approved into vouches
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

  -- Materialize the atomic vouch with relationship label and name approval consent
  if v_invite.vouch_text is not null and v_invite.inviter_id is not null then
    insert into vouches (voucher_id, vouchee_id, text, relationship_label, voucher_name_approved)
    values (
      v_invite.inviter_id,
      p_profile_id,
      v_invite.vouch_text,
      v_invite.relationship_label,
      coalesce(v_invite.voucher_name_approved, false)
    )
    on conflict (voucher_id, vouchee_id) do update set
      text = excluded.text,
      relationship_label = coalesce(excluded.relationship_label, vouches.relationship_label),
      voucher_name_approved = excluded.voucher_name_approved;
  end if;

  update profiles set is_member = true where id = p_profile_id;

  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;
