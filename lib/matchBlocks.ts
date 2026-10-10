import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "./events.ts";

export type MatchBlock = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  blocked_by: string;
  match_id: string | null;
  created_at: string;
};

/**
 * Returns canonical participant pair keys (ordered p1 < p2).
 */
export function canonicalPair(
  p1: string,
  p2: string
): { user_a_id: string; user_b_id: string } {
  return p1 < p2
    ? { user_a_id: p1, user_b_id: p2 }
    : { user_a_id: p2, user_b_id: p1 };
}

export function canonicalPairKey(p1: string, p2: string): string {
  return p1 < p2 ? `${p1}:${p2}` : `${p2}:${p1}`;
}

export type BlockMatchResult =
  | { ok: true; partner_id: string; duplicate?: boolean }
  | { ok: false; error: "match_not_found" | "forbidden" | "db_error" };

/**
 * Blocks a match between caller and their partner.
 * Idempotent: safe to invoke repeatedly.
 * Emits a safety audit event.
 */
export async function blockMatch(
  supabase: SupabaseClient,
  blockerProfileId: string,
  matchId: string
): Promise<BlockMatchResult> {
  const { data: match, error: fetchErr } = await supabase
    .from("matches")
    .select("id, a_id, b_id, status")
    .eq("id", matchId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: "db_error" };
  if (!match) return { ok: false, error: "match_not_found" };

  if (match.a_id !== blockerProfileId && match.b_id !== blockerProfileId) {
    return { ok: false, error: "forbidden" };
  }

  const partnerId = match.a_id === blockerProfileId ? match.b_id : match.a_id;
  const { user_a_id, user_b_id } = canonicalPair(blockerProfileId, partnerId);

  // Check if block already exists
  const { data: existing } = await supabase
    .from("match_blocks")
    .select("id")
    .eq("user_a_id", user_a_id)
    .eq("user_b_id", user_b_id)
    .maybeSingle();

  if (existing) {
    return { ok: true, partner_id: partnerId, duplicate: true };
  }

  const { error: insErr } = await supabase.from("match_blocks").insert({
    user_a_id,
    user_b_id,
    blocked_by: blockerProfileId,
    match_id: matchId,
  });

  if (insErr && !/duplicate|unique/i.test(insErr.message)) {
    return { ok: false, error: "db_error" };
  }

  // If match was still pending, update status to declined
  if (match.status === "pending") {
    await supabase
      .from("matches")
      .update({ status: "declined" })
      .eq("id", matchId);
  }

  // Emit safety event
  await logEvent({
    supabase,
    eventType: "match_blocked",
    actorProfileId: blockerProfileId,
    matchId,
    targetId: partnerId,
    metadata: {
      canonical_pair: `${user_a_id}:${user_b_id}`,
      match_id: matchId,
    },
  });

  return { ok: true, partner_id: partnerId };
}

/**
 * Loads all blocked pair keys for global pair exclusion in the matcher.
 */
export async function loadBlockedPairKeys(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("match_blocks")
    .select("user_a_id, user_b_id");

  if (error) throw error;

  const set = new Set<string>();
  for (const row of data ?? []) {
    set.add(canonicalPairKey(row.user_a_id, row.user_b_id));
  }
  return set;
}

/**
 * Lists all partner profile IDs that have an active block involving this user (either direction).
 */
export async function listBlockedPartnerIdsForUser(
  supabase: SupabaseClient,
  profileId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("match_blocks")
    .select("user_a_id, user_b_id")
    .or(`user_a_id.eq.${profileId},user_b_id.eq.${profileId}`);

  if (error) throw error;

  const blockedUserIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.user_a_id === profileId) blockedUserIds.add(row.user_b_id);
    else blockedUserIds.add(row.user_a_id);
  }
  return blockedUserIds;
}
