import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { generateMatchRationale } from "@/lib/matchRationale";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile || !profile.is_member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Fetch matches (scores omitted by design)
  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select("id, status, a_id, b_id, accepted_at, match_cycles(started_at)")
    .or(`a_id.eq.${profile.id},b_id.eq.${profile.id}`)
    .order("started_at", { foreignTable: "match_cycles", ascending: false });

  if (matchErr) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const matchIds = matches.map((m) => m.id);
  const partnerIds = matches.map((m) => (m.a_id === profile.id ? m.b_id : m.a_id));

  // Fetch match_responses
  const { data: responses } = await supabase
    .from("match_responses")
    .select("match_id, profile_id, response, responded_at")
    .in("match_id", matchIds);

  // Fetch feedback submitted by the caller
  const { data: feedbacks } = await supabase
    .from("match_feedback")
    .select("match_id, would_meet_again, note")
    .eq("profile_id", profile.id)
    .in("match_id", matchIds);

  // Fetch match_dates for scheduling and check-in status
  const { data: matchDates } = await supabase
    .from("match_dates")
    .select("match_id, status, scheduled_at, checked_in_at")
    .in("match_id", matchIds);

  // Fetch questionnaire responses for rationale generation
  const allProfileIds = [...new Set([profile.id, ...partnerIds])];
  const { data: qResponses } = await supabase
    .from("questionnaire_responses")
    .select("profile_id, answers")
    .in("profile_id", allProfileIds);

  const answersMap = new Map(
    (qResponses ?? []).map((q) => [
      q.profile_id,
      q.answers as Record<string, unknown> | undefined,
    ])
  );

  // Fetch partner profiles ONLY for accepted matches (enforce contact details hidden until accepted)
  const acceptedPartnerIds = matches
    .filter((m) => m.status === "accepted")
    .map((m) => (m.a_id === profile.id ? m.b_id : m.a_id));

  let partnerProfileMap = new Map<string, { telegram_username: string | null }>();
  if (acceptedPartnerIds.length > 0) {
    const { data: partnerProfiles } = await supabase
      .from("profiles")
      .select("id, telegram_username")
      .in("id", acceptedPartnerIds);

    partnerProfileMap = new Map(
      (partnerProfiles ?? []).map((p) => [
        p.id,
        { telegram_username: p.telegram_username ?? null },
      ])
    );
  }

  const callerAnswers = answersMap.get(profile.id);

  const results = matches.map((match) => {
    const partnerId = match.a_id === profile.id ? match.b_id : match.a_id;
    const partnerAnswers = answersMap.get(partnerId);
    const rationale = generateMatchRationale(callerAnswers, partnerAnswers);

    const matchResponses = (responses ?? []).filter((r) => r.match_id === match.id);
    const myResp = matchResponses.find((r) => r.profile_id === profile.id)?.response ?? null;
    const partnerResp = matchResponses.find((r) => r.profile_id === partnerId)?.response ?? null;

    const feedback = (feedbacks ?? []).find((f) => f.match_id === match.id) ?? null;

    // Security rule: contact details stay hidden until status === "accepted"
    let contact: { telegram_username: string | null } | null = null;
    if (match.status === "accepted") {
      const partnerData = partnerProfileMap.get(partnerId);
      contact = {
        telegram_username: partnerData?.telegram_username ?? null,
      };
    }

    const cycleInfo = match.match_cycles as unknown as { started_at?: string } | null;

    const dateRecord = (matchDates ?? []).find((d) => d.match_id === match.id) ?? null;
    const date = dateRecord
      ? {
          status: dateRecord.status,
          scheduled_at: dateRecord.scheduled_at,
          checked_in_at: dateRecord.checked_in_at,
        }
      : {
          status: "not_planned",
          scheduled_at: null,
          checked_in_at: null,
        };

    return {
      id: match.id,
      status: match.status,
      cycle_started_at: cycleInfo?.started_at ?? null,
      accepted_at: match.accepted_at ?? null,
      my_response: myResp,
      partner_responded: Boolean(partnerResp),
      rationale,
      contact,
      date,
      feedback: feedback
        ? {
            would_meet_again: feedback.would_meet_again,
            note: feedback.note,
          }
        : null,
    };
  });

  return NextResponse.json({ matches: results });
}
