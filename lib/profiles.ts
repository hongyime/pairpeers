import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  telegram_id: number;
  display_name: string | null;
  is_member: boolean;
  is_founder: boolean;
};

/**
 * Ensures a profile row exists for the verified Telegram identity.
 * One Telegram identity = one profile, forever (Sybil defense).
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  telegramId: number,
  displayName: string | null
): Promise<Profile> {
  const { data: existing, error: readErr } = await supabase
    .from("profiles")
    .select("id, telegram_id, display_name, is_member, is_founder")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) {
    // Fill in a missing display name, never overwrite a curated one with null.
    if (!existing.display_name && displayName) {
      const { data: updated, error: updErr } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", existing.id)
        .select("id, telegram_id, display_name, is_member, is_founder")
        .single();
      if (updErr) throw updErr;
      return updated as Profile;
    }
    return existing as Profile;
  }
  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert({ telegram_id: telegramId, display_name: displayName })
    .select("id, telegram_id, display_name, is_member, is_founder")
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
    .select("id, telegram_id, display_name, is_member, is_founder")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}
