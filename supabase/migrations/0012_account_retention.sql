-- PairPeers migration 0012: account anonymization and retention.

-- 1. Add deleted_at tombstone column to profiles
alter table profiles
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_at_idx on profiles(deleted_at);

-- 2. Anonymize profile RPC
-- Scrambles telegram_id and username, wipes questionnaire answers,
-- marks membership false, expires unredeemed invites, and records deleted_at.
-- Does NOT cascade-delete profiles or matches, preserving partner history intact.
create or replace function anonymize_profile(p_profile_id uuid)
returns jsonb as $$
declare
  v_profile profiles%rowtype;
  v_scrambled_tg bigint;
begin
  select * into v_profile from profiles where id = p_profile_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  -- Idempotent check
  if v_profile.deleted_at is not null then
    return jsonb_build_object('ok', true, 'already_anonymized', true);
  end if;

  -- Unique negative bigint so it never collides with positive Telegram IDs
  v_scrambled_tg := -1 * ((extract(epoch from now())::bigint * 1000) + floor(random() * 999)::bigint);

  -- Anonymize identity fields
  update profiles
  set
    telegram_id = v_scrambled_tg,
    telegram_username = null,
    display_name = 'Former Member',
    is_member = false,
    deleted_at = now()
  where id = p_profile_id;

  -- Wipe questionnaire responses
  update questionnaire_responses
  set
    answers = '{}'::jsonb,
    updated_at = now()
  where profile_id = p_profile_id;

  -- Expire any unredeemed invites issued by this profile
  update invites
  set expires_at = now()
  where inviter_id = p_profile_id and uses < max_uses;

  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer;
