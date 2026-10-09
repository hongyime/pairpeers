import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  telegram_id: number;
  display_name: string | null;
  is_member: boolean;
  is_founder: boolean;
  phone_e164: string | null;
};

const PROFILE_COLS =
  "id, telegram_id, display_name, is_member, is_founder, phone_e164";

/**
 * Ensures a profile row exists for the verified Telegram identity.
 * One Telegram identity = one profile, forever (Sybil defense).
 * Fills in missing display name / phone; never overwrites stored values.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  telegramId: number,
  displayName: string | null,
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
    if (!existing.display_name && displayName) patch.display_name = displayName;
    if (!existing.phone_e164 && phoneE164) patch.phone_e164 = phoneE164;
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
