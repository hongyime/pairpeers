import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const STATUS_COPY: Record<string, string> = {
  pending: "Waiting for mutual opt-in",
  accepted: "Mutually accepted",
  declined: "Declined",
  expired: "Expired",
};

/** Member's match list, read-only. Opt-in actions are a separate task. */
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

  const { data: matches } = await supabase
    .from("matches")
    .select("id, status, match_cycles(started_at)")
    .or(`a_id.eq.${profile.id},b_id.eq.${profile.id}`)
    .order("started_at", { foreignTable: "match_cycles", ascending: false });

  return (
    <main className="centered">
      <div className="card narrow">
        <div className="eyebrow">Matches</div>
        <h1>My matches</h1>
        {!matches || matches.length === 0 ? (
          <p className="muted">
            No introductions yet. Once a matching cycle runs and you are
            paired, your introduction will appear here.
          </p>
        ) : (
          <ul className="match-list">
            {matches.map((match) => (
              <li key={match.id} className="match-row">
                <div>
                  <strong>{STATUS_COPY[match.status] ?? match.status}</strong>
                  {match.status === "pending" && (
                    <p className="muted small">
                      You have 72 hours to opt in mutually.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          <Link href="/">← Back home</Link>
        </p>
      </div>
    </main>
  );
}
