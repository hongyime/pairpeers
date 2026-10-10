import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountProfileExport = {
  id: string;
  display_name: string | null;
  telegram_username: string | null;
  created_at: string;
  is_member: boolean;
};

export type AccountInviteExport = {
  code: string;
  uses: number;
  max_uses: number;
  expires_at: string;
  created_at: string;
  vouch_text: string | null;
};

export type AccountVouchExport = {
  text: string;
  created_at: string;
  voucher_name?: string;
};

export type AccountMatchExport = {
  id: string;
  status: string;
  cycle_started_at: string | null;
  accepted_at: string | null;
  my_response: string | null;
  date_status: string | null;
  my_feedback: {
    would_meet_again: boolean;
    note: string | null;
  } | null;
};

export type AccountExportData = {
  exported_at: string;
  profile: AccountProfileExport;
  questionnaire: Record<string, unknown>;
  invites: AccountInviteExport[];
  vouches_given: AccountVouchExport[];
  vouches_received: AccountVouchExport[];
  matches: AccountMatchExport[];
};

export type RawExportInput = {
  profile: {
    id: string;
    display_name: string | null;
    telegram_username: string | null;
    created_at: string;
    is_member: boolean;
  };
  questionnaire?: Record<string, unknown> | null;
  invites?: Array<{
    code: string;
    uses: number;
    max_uses: number;
    expires_at: string;
    created_at: string;
    vouch_text: string | null;
  }> | null;
  vouchesGiven?: Array<{
    text: string;
    created_at: string;
  }> | null;
  vouchesReceived?: Array<{
    text: string;
    created_at: string;
    voucher_name_approved?: boolean;
    voucher?: { display_name: string | null } | null;
  }> | null;
  matches?: Array<{
    id: string;
    status: string;
    accepted_at?: string | null;
    match_cycles?: { started_at?: string } | null;
    date?: { status: string } | null;
    my_response?: string | null;
    my_feedback?: { would_meet_again: boolean; note: string | null } | null;
  }> | null;
};

/**
 * Pure function to filter and sanitize export data.
 * STRICT PRIVACY GUARANTEE: Never includes partner answers, partner contact
 * information, or partner's private feedback.
 */
export function sanitizeExportData(input: RawExportInput): AccountExportData {
  const profile: AccountProfileExport = {
    id: input.profile.id,
    display_name: input.profile.display_name,
    telegram_username: input.profile.telegram_username,
    created_at: input.profile.created_at,
    is_member: input.profile.is_member,
  };

  const questionnaire = input.questionnaire ?? {};

  const invites: AccountInviteExport[] = (input.invites ?? []).map((inv) => ({
    code: inv.code,
    uses: inv.uses,
    max_uses: inv.max_uses,
    expires_at: inv.expires_at,
    created_at: inv.created_at,
    vouch_text: inv.vouch_text,
  }));

  const vouches_given: AccountVouchExport[] = (input.vouchesGiven ?? []).map((v) => ({
    text: v.text,
    created_at: v.created_at,
  }));

  const vouches_received: AccountVouchExport[] = (input.vouchesReceived ?? []).map((v) => ({
    text: v.text,
    created_at: v.created_at,
    voucher_name:
      v.voucher_name_approved === false
        ? "A friend"
        : (v.voucher?.display_name ?? "A friend"),
  }));

  const matches: AccountMatchExport[] = (input.matches ?? []).map((m) => ({
    id: m.id,
    status: m.status,
    cycle_started_at: m.match_cycles?.started_at ?? null,
    accepted_at: m.accepted_at ?? null,
    my_response: m.my_response ?? null,
    date_status: m.date?.status ?? null,
    my_feedback: m.my_feedback ?? null,
  }));

  return {
    exported_at: new Date().toISOString(),
    profile,
    questionnaire,
    invites,
    vouches_given,
    vouches_received,
    matches,
  };
}

/**
 * Performs account anonymization via RPC. Falls back to manual transaction
 * if RPC is not present in local test mock DB.
 */
export async function deleteAccount(
  supabase: any,
  profileId: string
): Promise<{ ok: boolean; already_anonymized?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("anonymize_profile", {
      p_profile_id: profileId,
    });

    if (!error && data) {
      return data;
    }

    if (error && !error.message?.includes("function") && !error.message?.includes("does not exist")) {
      return { ok: false, error: error.message };
    }
  } catch (err) {
    // If RPC call fails, continue to fallback
  }

  // Fallback direct execution (matches 0012 RPC logic)
  const { data: prof, error: getErr } = await supabase
    .from("profiles")
    .select("id, deleted_at")
    .eq("id", profileId)
    .maybeSingle();

  if (getErr) return { ok: false, error: getErr.message };
  if (!prof) return { ok: false, error: "profile_not_found" };
  if (prof.deleted_at) return { ok: true, already_anonymized: true };

  const scrambledTg = -1 * (Date.now() * 1000 + Math.floor(Math.random() * 999));

  await supabase
    .from("profiles")
    .update({
      telegram_id: scrambledTg,
      telegram_username: null,
      display_name: "Former Member",
      is_member: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  await supabase
    .from("questionnaire_responses")
    .update({ answers: {}, updated_at: new Date().toISOString() })
    .eq("profile_id", profileId);

  await supabase
    .from("invites")
    .update({ expires_at: new Date().toISOString() })
    .eq("inviter_id", profileId);

  return { ok: true };
}

/**
 * Gathers user data and returns a privacy-filtered export.
 */
export async function exportAccountData(
  supabase: SupabaseClient,
  profileId: string
): Promise<AccountExportData> {
  // 1. Profile
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name, telegram_username, created_at, is_member")
    .eq("id", profileId)
    .single();

  if (profErr || !profile) {
    throw new Error(profErr?.message ?? "Profile not found");
  }

  // 2. Questionnaire
  const { data: qRow } = await supabase
    .from("questionnaire_responses")
    .select("answers")
    .eq("profile_id", profileId)
    .maybeSingle();

  // 3. Invites
  const { data: invites } = await supabase
    .from("invites")
    .select("code, uses, max_uses, expires_at, created_at, vouch_text")
    .eq("inviter_id", profileId);

  // 4. Vouches given
  const { data: vouchesGiven } = await supabase
    .from("vouches")
    .select("text, created_at")
    .eq("voucher_id", profileId);

  // 5. Vouches received
  const { data: vouchesReceived } = await supabase
    .from("vouches")
    .select("text, created_at, voucher_name_approved, voucher:profiles!vouches_voucher_id_fkey(display_name)")
    .eq("vouchee_id", profileId);

  // 6. Matches
  const { data: matches } = await supabase
    .from("matches")
    .select("id, status, accepted_at, a_id, b_id, match_cycles(started_at)")
    .or(`a_id.eq.${profileId},b_id.eq.${profileId}`);

  const matchIds = (matches ?? []).map((m: any) => m.id);

  // Fetch own responses
  const { data: responses } = await supabase
    .from("match_responses")
    .select("match_id, response")
    .eq("profile_id", profileId)
    .in("match_id", matchIds);

  const respMap = new Map((responses ?? []).map((r: any) => [r.match_id, r.response]));

  // Fetch own feedback
  const { data: feedbacks } = await supabase
    .from("match_feedback")
    .select("match_id, would_meet_again, note")
    .eq("profile_id", profileId)
    .in("match_id", matchIds);

  const fbMap = new Map(
    (feedbacks ?? []).map((f: any) => [
      f.match_id,
      { would_meet_again: f.would_meet_again, note: f.note },
    ])
  );

  // Fetch match dates
  const { data: matchDates } = await supabase
    .from("match_dates")
    .select("match_id, status")
    .in("match_id", matchIds);

  const dateMap = new Map((matchDates ?? []).map((d: any) => [d.match_id, d.status]));

  const enrichedMatches = (matches ?? []).map((m: any) => ({
    id: m.id,
    status: m.status,
    accepted_at: m.accepted_at,
    match_cycles: m.match_cycles,
    date: { status: dateMap.get(m.id) ?? "not_planned" },
    my_response: respMap.get(m.id) ?? null,
    my_feedback: fbMap.get(m.id) ?? null,
  }));

  return sanitizeExportData({
    profile,
    questionnaire: (qRow?.answers as Record<string, unknown>) ?? {},
    invites: invites ?? [],
    vouchesGiven: vouchesGiven ?? [],
    vouchesReceived: (vouchesReceived as any) ?? [],
    matches: enrichedMatches,
  });
}
