import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/botNotify";
import { computeOptInTransition, type MatchOptInAction } from "@/lib/matchOptIn";
import { generateMatchRationale } from "@/lib/matchRationale";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function handleMatchOptIn(
  req: NextRequest,
  params: Promise<{ id: string }>,
  action: MatchOptInAction
) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile || !profile.is_member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: matchId } = await params;
  if (!matchId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, status, a_id, b_id, accepted_at, match_cycles(started_at)")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!match) {
    return NextResponse.json({ error: "match_not_found" }, { status: 404 });
  }

  if (profile.id !== match.a_id && profile.id !== match.b_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: responses, error: respError } = await supabase
    .from("match_responses")
    .select("profile_id, response, responded_at")
    .eq("match_id", matchId);

  if (respError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Fetch questionnaire responses to compute conversation starter if needed
  const { data: qResponses } = await supabase
    .from("questionnaire_responses")
    .select("profile_id, answers")
    .in("profile_id", [match.a_id, match.b_id]);

  const aAnswers = qResponses?.find((r) => r.profile_id === match.a_id)?.answers as
    | Record<string, unknown>
    | undefined;
  const bAnswers = qResponses?.find((r) => r.profile_id === match.b_id)?.answers as
    | Record<string, unknown>
    | undefined;
  const rationale = generateMatchRationale(aAnswers, bAnswers);

  const cycleRecord = match.match_cycles as unknown as { started_at?: string } | null;
  const cycleStartedAt = cycleRecord?.started_at ?? new Date().toISOString();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me").replace(
    /\/$/,
    ""
  );

  const transition = computeOptInTransition(
    {
      id: match.id,
      status: match.status,
      a_id: match.a_id,
      b_id: match.b_id,
      cycle_started_at: cycleStartedAt,
      accepted_at: match.accepted_at,
    },
    profile.id,
    action,
    responses ?? [],
    {
      baseUrl,
      sharedInterests: rationale.sharedInterests,
    }
  );

  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: transition.status });
  }

  if (transition.noop) {
    return NextResponse.json({ ok: true, status: transition.nextMatchStatus, noop: true });
  }

  // Persist response
  if (transition.responseToRecord) {
    const { error: insErr } = await supabase.from("match_responses").upsert(
      {
        match_id: match.id,
        profile_id: transition.responseToRecord.profileId,
        response: transition.responseToRecord.response,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "match_id,profile_id" }
    );
    if (insErr) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  // Update match status
  if (transition.nextMatchStatus !== match.status) {
    const patch: Record<string, unknown> = { status: transition.nextMatchStatus };
    if (transition.nextMatchStatus === "accepted") {
      patch.accepted_at = new Date().toISOString();
    }
    const { error: updErr } = await supabase.from("matches").update(patch).eq("id", match.id);
    if (updErr) {
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  // Deliver notifications
  if (transition.notifications.length > 0) {
    const recipientIds = transition.notifications.map((n) => n.recipientProfileId);
    const { data: recipientProfiles } = await supabase
      .from("profiles")
      .select("id, telegram_id")
      .in("id", recipientIds);

    const tgMap = new Map((recipientProfiles ?? []).map((p) => [p.id, Number(p.telegram_id)]));

    for (const notif of transition.notifications) {
      const tgId = tgMap.get(notif.recipientProfileId);
      if (tgId) {
        try {
          await sendTelegramMessage(tgId, notif.text);
        } catch (err) {
          console.error(`[botNotify] failed to send Telegram message to ${tgId}:`, err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, status: transition.nextMatchStatus });
}
