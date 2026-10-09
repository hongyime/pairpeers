import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/botNotify";
import { runCycle, type CycleAnswers, type CycleParticipant } from "@/lib/matchingCycle";
import { getProfileByTelegramId } from "@/lib/profiles";
import { validateAnswers } from "@/lib/questionnaire";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type Audit = {
  pool_size?: number;
  eligible_pair_count?: number;
  excluded_counts?: Record<string, number>;
  pairs?: Array<{ a_id: string; b_id: string; a_score: number; b_score: number }>;
  algorithm_path?: string;
  unmatched_member_ids?: string[];
  age_filter_skipped_member_ids?: string[];
  notifications?: Record<string, "sent" | "failed">;
  timestamp?: string;
};

function summary(audit: Audit | null | undefined) {
  const pairs = audit?.pairs ?? [];
  const notifications = audit?.notifications ?? {};
  const notified = Object.values(notifications).filter((s) => s === "sent").length;
  const failed = Object.values(notifications).filter((s) => s === "failed").length;
  return {
    cycle_id: undefined,
    pool_size: audit?.pool_size ?? 0,
    eligible_pair_count: audit?.eligible_pair_count ?? 0,
    matched_count: pairs.length * 2,
    pair_count: pairs.length,
    unmatched_count: audit?.unmatched_member_ids?.length ?? 0,
    algorithm: audit?.algorithm_path ?? null,
    excluded_counts: audit?.excluded_counts ?? {},
    notifications_sent: notified,
    notifications_failed: failed,
  };
}

async function requireFounder(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "not_configured" as const };
  const supabase = await createSupabaseServerClient();
  const cronSecret = process.env.CRON_SECRET;
  const cronOk = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (cronOk) return { supabase };

  const telegramId = await getSessionTelegramId(req);
  const profile = telegramId ? await getProfileByTelegramId(supabase, telegramId) : null;
  if (!profile?.is_founder) return { error: "forbidden" as const };
  return { supabase };
}

async function getOpenCycle(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  return supabase
    .from("match_cycles")
    .select("id, audit")
    .is("closed_at", null)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

function responseForCycle(cycleId: string, audit: Audit) {
  return NextResponse.json({ ...summary(audit), cycle_id: cycleId });
}

export async function POST(req: NextRequest) {
  const auth = await requireFounder(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.error === "forbidden" ? 403 : 503 });
  }
  const { supabase } = auth;

  const action = req.nextUrl.searchParams.get("action");
  const open = await getOpenCycle(supabase);
  if (open.error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  if (action === "close") {
    if (!open.data) return NextResponse.json({ error: "no_open_cycle" }, { status: 404 });
    const { error } = await supabase
      .from("match_cycles")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", open.data.id)
      .is("closed_at", null);
    if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
    return responseForCycle(open.data.id, (open.data.audit ?? {}) as Audit);
  }

  if (action === "renotify") {
    if (!open.data) return NextResponse.json({ error: "no_open_cycle" }, { status: 404 });
    return renotify(supabase, open.data.id, (open.data.audit ?? {}) as Audit);
  }

  if (open.data) return responseForCycle(open.data.id, (open.data.audit ?? {}) as Audit);

  const [{ data: profiles, error: profilesError }, { data: responses, error: responsesError }, { data: existingMatches, error: matchesError }] = await Promise.all([
    supabase.from("profiles").select("id, telegram_id, is_member"),
    supabase.from("questionnaire_responses").select("profile_id, answers"),
    supabase.from("matches").select("a_id, b_id, status").in("status", ["pending", "accepted"]),
  ]);
  if (profilesError || responsesError || matchesError) return NextResponse.json({ error: "db_error" }, { status: 500 });

  const excluded: Record<string, number> = {
    not_member: 0,
    missing_questionnaire: 0,
    incomplete_questionnaire: 0,
    already_matched: 0,
  };
  const matchedIds = new Set<string>();
  for (const match of existingMatches ?? []) {
    matchedIds.add(match.a_id);
    matchedIds.add(match.b_id);
  }
  const responseByProfile = new Map((responses ?? []).map((row) => [row.profile_id, row.answers]));
  const participantById = new Map<string, CycleParticipant>();
  const telegramById = new Map<string, number>();

  for (const profile of profiles ?? []) {
    if (!profile.is_member) {
      excluded.not_member += 1;
      continue;
    }
    if (matchedIds.has(profile.id)) {
      excluded.already_matched += 1;
      continue;
    }
    const rawAnswers = responseByProfile.get(profile.id);
    if (!rawAnswers) {
      excluded.missing_questionnaire += 1;
      continue;
    }
    const validated = validateAnswers(rawAnswers);
    if (!validated.ok) {
      excluded.incomplete_questionnaire += 1;
      continue;
    }
    participantById.set(profile.id, { id: profile.id, answers: validated.answers as unknown as CycleAnswers });
    telegramById.set(profile.id, Number(profile.telegram_id));
  }

  const participants = [...participantById.values()].sort((left, right) => left.id.localeCompare(right.id));
  const result = runCycle(participants);
  const now = new Date().toISOString();
  const audit: Audit = {
    pool_size: participants.length,
    eligible_pair_count: result.eligiblePairCount,
    excluded_counts: { ...excluded, ...result.excludedPairCounts },
    pairs: result.pairs.map((pair) => ({ a_id: pair.aId, b_id: pair.bId, a_score: pair.aScore, b_score: pair.bScore })),
    algorithm_path: result.algorithm,
    unmatched_member_ids: result.unmatched,
    age_filter_skipped_member_ids: result.ageFilterSkippedMemberIds,
    timestamp: now,
  };

  const { data: cycle, error: cycleError } = await supabase
    .from("match_cycles")
    .insert({ audit })
    .select("id, audit")
    .single();
  if (cycleError || !cycle) {
    const retry = await getOpenCycle(supabase);
    if (!retry.error && retry.data) return responseForCycle(retry.data.id, (retry.data.audit ?? {}) as Audit);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (result.pairs.length > 0) {
    const { error: insertError } = await supabase.from("matches").insert(
      result.pairs.map((pair) => ({
        cycle_id: cycle.id,
        a_id: pair.aId,
        b_id: pair.bId,
        a_score: pair.aScore,
        b_score: pair.bScore,
        status: "pending",
      }))
    );
    if (insertError) return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me").replace(/\/$/, "");
  const notifications: Record<string, "sent" | "failed"> = {};
  const notifyText = `You have a new introduction waiting in PairPeers. You have 72 hours to opt in mutually. View it here: ${baseUrl}/matches`;
  for (const pair of result.pairs) {
    for (const memberId of [pair.aId, pair.bId]) {
      const telegramId = telegramById.get(memberId);
      if (!telegramId) {
        notifications[memberId] = "failed";
        continue;
      }
      try {
        await sendTelegramMessage(telegramId, notifyText);
        notifications[memberId] = "sent";
      } catch {
        notifications[memberId] = "failed";
      }
    }
  }
  audit.notifications = notifications;
  await supabase.from("match_cycles").update({ audit }).eq("id", cycle.id);

  return responseForCycle(cycle.id, audit);
}

async function renotify(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  cycleId: string,
  audit: Audit
) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me").replace(/\/$/, "");
  const { data: profiles } = await supabase.from("profiles").select("id, telegram_id");
  const telegramById = new Map((profiles ?? []).map((p) => [p.id, Number(p.telegram_id)]));
  const notifications = { ...(audit.notifications ?? {}) };
  const notifyText = `You have a new introduction waiting in PairPeers. You have 72 hours to opt in mutually. View it here: ${baseUrl}/matches`;
  for (const pair of audit.pairs ?? []) {
    for (const memberId of [pair.a_id, pair.b_id]) {
      if (notifications[memberId] === "sent") continue;
      const telegramId = telegramById.get(memberId);
      if (!telegramId) {
        notifications[memberId] = "failed";
        continue;
      }
      try {
        await sendTelegramMessage(telegramId, notifyText);
        notifications[memberId] = "sent";
      } catch {
        notifications[memberId] = "failed";
      }
    }
  }
  const updated: Audit = { ...audit, notifications };
  await supabase.from("match_cycles").update({ audit: updated }).eq("id", cycleId);
  return NextResponse.json({ ...summary(updated), cycle_id: cycleId });
}
