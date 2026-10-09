import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  telegram_id: number;
  display_name: string | null;
  telegram_username: string | null;
  is_member: boolean;
  is_founder: boolean;
  phone_e164: string | null;
};

const PROFILE_COLS =
  "id, telegram_id, display_name, telegram_username, is_member, is_founder, phone_e164";

/**
 * Ensures a profile row exists for the verified Telegram identity.
 * One Telegram identity = one profile, forever (Sybil defense).
 *
 * Telegram is the source of truth for identity fields: on every login the
 * stored display name / username / phone are refreshed when the token
 * carries a new non-null value. Missing claims never wipe stored values.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  telegramId: number,
  displayName: string | null,
  username: string | null = null,
  phoneE164: string | null = null
): Promise<Profile> {
  const { data: existing, error: readErr } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) {
    const patch: Record<string, string> = {};
    if (displayName && displayName !== existing.display_name)
      patch.display_name = displayName;
    if (username && username !== existing.telegram_username)
      patch.telegram_username = username;
    if (phoneE164 && phoneE164 !== existing.phone_e164)
      patch.phone_e164 = phoneE164;
    if (Object.keys(patch).length > 0) {
      const { data: updated, error: updErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", existing.id)
        .select(PROFILE_COLS)
        .single();
      if (updErr) throw updErr;
      return updated as Profile;
    }
    return existing as Profile;
  }
  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert({
      telegram_id: telegramId,
      display_name: displayName,
      telegram_username: username,
      phone_e164: phoneE164,
    })
    .select(PROFILE_COLS)
    .single();
  if (insErr) throw insErr;
  return created as Profile;
}

/** Resolves the session's Telegram ID to its profile (null if none). */
export async function getProfileByTelegramId(
  supabase: SupabaseClient,
  telegramId: number
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}
