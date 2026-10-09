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

  if (action === "sweep") {
    return runSweep(supabase);
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

async function runSweep(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const now = new Date();
  const nowMs = now.getTime();
  const EXPIRY_MS = 72 * 60 * 60 * 1000;
  const NUDGE_7D_MS = 7 * 24 * 60 * 60 * 1000;
  const NUDGE_14D_MS = 14 * 24 * 60 * 60 * 1000;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me").replace(
    /\/$/,
    ""
  );

  // 1. Expiry sweep (pending matches older than 72h)
  const { data: pendingMatches, error: pendingErr } = await supabase
    .from("matches")
    .select("id, cycle_id, match_cycles(id, started_at, audit)")
    .eq("status", "pending");

  if (pendingErr) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const expiredMatchIds: string[] = [];
  const cycleExpiredCounts = new Map<
    string,
    { count: number; audit: Record<string, unknown> }
  >();

  for (const match of pendingMatches ?? []) {
    const cycle = match.match_cycles as unknown as {
      id: string;
      started_at: string;
      audit: Record<string, unknown>;
    } | null;
    if (!cycle?.started_at) continue;

    const cycleStartMs = new Date(cycle.started_at).getTime();
    if (nowMs - cycleStartMs > EXPIRY_MS) {
      expiredMatchIds.push(match.id);
      const current = cycleExpiredCounts.get(cycle.id) ?? {
        count: 0,
        audit: (cycle.audit ?? {}) as Record<string, unknown>,
      };
      current.count += 1;
      cycleExpiredCounts.set(cycle.id, current);
    }
  }

  if (expiredMatchIds.length > 0) {
    const { error: expireErr } = await supabase
      .from("matches")
      .update({ status: "expired" })
      .in("id", expiredMatchIds);

    if (expireErr) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    for (const [cycleId, entry] of cycleExpiredCounts) {
      const prevAudit = entry.audit;
      const updatedAudit = {
        ...prevAudit,
        expired_matches_count:
          ((prevAudit.expired_matches_count as number) ?? 0) + entry.count,
        last_swept_at: now.toISOString(),
      };
      await supabase
        .from("match_cycles")
        .update({ audit: updatedAudit })
        .eq("id", cycleId);
    }
  }

  // 2. Telegram feedback nudges (7d and 14d post-acceptance)
  const { data: acceptedMatches, error: acceptedErr } = await supabase
    .from("matches")
    .select("id, a_id, b_id, accepted_at, match_cycles(started_at)")
    .eq("status", "accepted");

  if (acceptedErr) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const matchIds = (acceptedMatches ?? []).map((m) => m.id);
  let existingNudges: Array<{
    match_id: string;
    profile_id: string;
    nudge_type: string;
  }> = [];

  if (matchIds.length > 0) {
    const { data: nudgesData } = await supabase
      .from("match_nudges")
      .select("match_id, profile_id, nudge_type")
      .in("match_id", matchIds);
    existingNudges = nudgesData ?? [];
  }

  const sentNudgeSet = new Set(
    existingNudges.map((n) => `${n.match_id}:${n.profile_id}:${n.nudge_type}`)
  );

  const participantIds = new Set<string>();
  for (const match of acceptedMatches ?? []) {
    participantIds.add(match.a_id);
    participantIds.add(match.b_id);
  }

  let tgMap = new Map<string, number>();
  if (participantIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, telegram_id")
      .in("id", [...participantIds]);
    tgMap = new Map((profiles ?? []).map((p) => [p.id, Number(p.telegram_id)]));
  }

  let nudges7dSent = 0;
  let nudges14dSent = 0;

  for (const match of acceptedMatches ?? []) {
    const cycleInfo = match.match_cycles as unknown as { started_at?: string } | null;
    const acceptedAtStr = match.accepted_at ?? cycleInfo?.started_at;
    if (!acceptedAtStr) continue;

    const acceptedMs = new Date(acceptedAtStr).getTime();
    const ageMs = nowMs - acceptedMs;
    const is7d = ageMs >= NUDGE_7D_MS;
    const is14d = ageMs >= NUDGE_14D_MS;

    for (const profileId of [match.a_id, match.b_id]) {
      const tgId = tgMap.get(profileId);
      if (!tgId) continue;

      const key7d = `${match.id}:${profileId}:day_7`;
      if (is7d && !sentNudgeSet.has(key7d)) {
        try {
          const msg = `How did your introduction go? Share private feedback in PairPeers: ${baseUrl}/matches`;
          await sendTelegramMessage(tgId, msg);
          await supabase.from("match_nudges").insert({
            match_id: match.id,
            profile_id: profileId,
            nudge_type: "day_7",
            sent_at: now.toISOString(),
          });
          sentNudgeSet.add(key7d);
          nudges7dSent += 1;
        } catch (err) {
          console.error(`[sweep] failed to send 7d nudge to ${tgId}:`, err);
        }
      }

      const key14d = `${match.id}:${profileId}:day_14`;
      if (is14d && !sentNudgeSet.has(key14d)) {
        try {
          const msg = `Would you meet your introduction again? Let us know privately in PairPeers: ${baseUrl}/matches`;
          await sendTelegramMessage(tgId, msg);
          await supabase.from("match_nudges").insert({
            match_id: match.id,
            profile_id: profileId,
            nudge_type: "day_14",
            sent_at: now.toISOString(),
          });
          sentNudgeSet.add(key14d);
          nudges14dSent += 1;
        } catch (err) {
          console.error(`[sweep] failed to send 14d nudge to ${tgId}:`, err);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    action: "sweep",
    expired_matches_count: expiredMatchIds.length,
    cycles_updated: cycleExpiredCounts.size,
    nudges_sent: {
      day_7: nudges7dSent,
      day_14: nudges14dSent,
    },
  });
}
