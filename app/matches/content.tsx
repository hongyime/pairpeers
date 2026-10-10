import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { generateMatchRationale } from "@/lib/matchRationale";
import { MatchItem } from "./MatchItem";

export async function MatchesContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const telegramId =
    secret && token
      ? (await verifySessionToken(token, secret))?.telegramId ?? null
      : null;
  if (!telegramId) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile?.is_member) redirect("/");

  // Fetch matches (scores intentionally excluded)
  const [{ data: rawMatches }, blockedPartnerIds] = await Promise.all([
    supabase
      .from("matches")
      .select("id, status, a_id, b_id, accepted_at, match_cycles(started_at)")
      .or(`a_id.eq.${profile.id},b_id.eq.${profile.id}`)
      .order("started_at", { foreignTable: "match_cycles", ascending: false }),
    (async () => {
      const { data: blocks } = await supabase
        .from("match_blocks")
        .select("user_a_id, user_b_id")
        .or(`user_a_id.eq.${profile.id},user_b_id.eq.${profile.id}`);
      const set = new Set<string>();
      for (const b of blocks ?? []) {
        set.add(b.user_a_id === profile.id ? b.user_b_id : b.user_a_id);
      }
      return set;
    })().catch(() => new Set<string>()),
  ]);

  const matches = (rawMatches ?? []).filter((m) => {
    const partnerId = m.a_id === profile.id ? m.b_id : m.a_id;
    return !blockedPartnerIds.has(partnerId);
  });

  if (!matches || matches.length === 0) {
    return (
      <main className="centered">
        <div className="card narrow">
          <div className="eyebrow">Matches</div>
          <h1>My matches</h1>
          <p className="muted">
            No introductions yet. Once a matching cycle runs and you are
            paired, your introduction will appear here.
          </p>
          <p className="muted small">
            <Link href="/">Back home</Link>
          </p>
        </div>
      </main>
    );
  }

  const matchIds = matches.map((m) => m.id);
  const partnerIds = matches.map((m) => (m.a_id === profile.id ? m.b_id : m.a_id));

  // Fetch responses
  const { data: responses } = await supabase
    .from("match_responses")
    .select("match_id, profile_id, response")
    .in("match_id", matchIds);

  // Fetch existing feedback submitted by the caller
  const { data: feedbacks } = await supabase
    .from("match_feedback")
    .select("match_id, would_meet_again, note")
    .eq("profile_id", profile.id)
    .in("match_id", matchIds);

  // Fetch match_dates for date coordination status
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

  // Fetch partner contact info ONLY for accepted matches
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

  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">Matches</div>
        <h1>My matches</h1>
        <ul className="match-list">
          {matches.map((match) => {
            const partnerId = match.a_id === profile.id ? match.b_id : match.a_id;
            const partnerAnswers = answersMap.get(partnerId);
            const rationale = generateMatchRationale(callerAnswers, partnerAnswers);

            const matchResponses = (responses ?? []).filter((r) => r.match_id === match.id);
            const myResp =
              matchResponses.find((r) => r.profile_id === profile.id)?.response ?? null;

            const feedback =
              (feedbacks ?? []).find((f) => f.match_id === match.id) ?? null;

            let contact: { telegram_username: string | null } | null = null;
            if (match.status === "accepted") {
              const partnerData = partnerProfileMap.get(partnerId);
              contact = {
                telegram_username: partnerData?.telegram_username ?? null,
              };
            }

            const dateRecord = (matchDates ?? []).find((d) => d.match_id === match.id) ?? null;

            return (
              <MatchItem
                key={match.id}
                id={match.id}
                initialStatus={match.status as "pending" | "accepted" | "declined" | "expired"}
                initialMyResponse={myResp as "accepted" | "declined" | null}
                rationale={rationale}
                contact={contact}
                initialFeedback={
                  feedback
                    ? {
                        would_meet_again: feedback.would_meet_again,
                        note: feedback.note,
                      }
                    : null
                }
                initialDate={
                  dateRecord
                    ? {
                        status: dateRecord.status,
                        scheduled_at: dateRecord.scheduled_at,
                        checked_in_at: dateRecord.checked_in_at,
                      }
                    : null
                }
              />
            );
          })}
        </ul>
        <p className="muted small" style={{ marginTop: "24px" }}>
          <Link href="/">← Back home</Link>
        </p>
      </div>
    </main>
  );
}
