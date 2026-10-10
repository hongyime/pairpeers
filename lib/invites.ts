import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INVITES_PER_USER,
  INVITE_TTL_DAYS,
  VOUCH_MIN_LEN,
  VOUCH_MAX_LEN,
} from "./inviteConstants.ts";

export { INVITES_PER_USER, INVITE_TTL_DAYS, VOUCH_MIN_LEN, VOUCH_MAX_LEN };

// 32 unambiguous symbols: no 0/O, 1/I/L. 32^6 ≈ 1B combinations.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LEN = 6;

/** Cryptographically random invite code, e.g. PP-X7K2M9. */
export function generateInviteCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `PP-${s}`;
}

export type InvitePreview =
  | {
      valid: true;
      inviter_name: string;
      vouch_text: string;
      expires_at: string;
    }
  | {
      valid: false;
      reason: "invalid_code" | "expired" | "already_redeemed" | "banned_code";
    };

/**
 * Public preview for an invite code. Returns ONLY inviter display name,
 * vouch text, and expiry — no Telegram IDs, quotas, or other invitees.
 */
export async function getInvitePreview(
  supabase: SupabaseClient,
  code: string
): Promise<InvitePreview> {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from("invites")
    .select("vouch_text, expires_at, uses, max_uses, profiles!invites_inviter_id_fkey(display_name, is_banned)")
    .eq("code", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { valid: false, reason: "invalid_code" };
  const profile = data.profiles as unknown as { display_name: string | null; is_banned?: boolean } | null;
  if (profile?.is_banned) return { valid: false, reason: "banned_code" };
  if (new Date(data.expires_at) <= new Date())
    return { valid: false, reason: "expired" };
  if (data.uses >= data.max_uses)
    return { valid: false, reason: "already_redeemed" };
  return {
    valid: true,
    inviter_name: profile?.display_name ?? "A friend",
    vouch_text: data.vouch_text ?? "",
    expires_at: data.expires_at,
  };
}

export type CreateInviteResult =
  | { ok: true; code: string; expires_at: string }
  | { ok: false; error: "not_member" | "quota_exhausted" | "vouch_invalid" };

/**
 * Creates an invite for a member profile. Enforces: membership (only vouched
 * members can invite — the friends-of-friends guarantee), the 3-invite
 * lifetime quota, and the atomic vouch (no vouch text, no invite).
 */
export async function createInvite(
  supabase: SupabaseClient,
  inviterProfileId: string,
  isMember: boolean,
  vouchText: string
): Promise<CreateInviteResult> {
  if (!isMember) return { ok: false, error: "not_member" };
  const vouch = vouchText.trim();
  if (vouch.length < VOUCH_MIN_LEN || vouch.length > VOUCH_MAX_LEN) {
    return { ok: false, error: "vouch_invalid" };
  }

  const { count, error: countErr } = await supabase
    .from("invites")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", inviterProfileId);
  if (countErr) throw countErr;
  if ((count ?? 0) >= INVITES_PER_USER) {
    return { ok: false, error: "quota_exhausted" };
  }

  // Uniqueness is enforced by the DB unique constraint; retry on collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const expires_at = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data, error } = await supabase
      .from("invites")
      .insert({
        code,
        inviter_id: inviterProfileId,
        vouch_text: vouch,
        expires_at,
        max_uses: 1,
      })
      .select("code, expires_at")
      .single();
    if (!error) return { ok: true, code: data.code, expires_at: data.expires_at };
    if (!/duplicate|unique/i.test(error.message)) throw error;
  }
  throw new Error("code_collision_retry_exhausted");
}

export type RedeemResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "invalid_code"
        | "expired"
        | "already_redeemed"
        | "self_redeem"
        | "banned_code"
        | "not_member";
    };

/**
 * Redeems an invite via the atomic `redeem_invite` Postgres function:
 * validate → consume → audit → materialize vouch → grant membership,
 * all in one transaction with a row lock. Exactly one concurrent attempt wins.
 */
export async function redeemInvite(
  supabase: SupabaseClient,
  code: string,
  profileId: string,
  ipHash: string | null
): Promise<RedeemResult> {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase.rpc("redeem_invite", {
    p_code: normalized,
    p_profile_id: profileId,
    p_ip_hash: ipHash,
  });
  if (error) throw error;
  return data as RedeemResult;
}

/** Lists the invites a profile created (for the /invites dashboard). */
export async function listMyInvites(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("invites")
    .select("code, vouch_text, expires_at, uses, max_uses, created_at")
    .eq("inviter_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
