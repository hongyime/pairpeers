import { cookies } from "next/headers";
import Link from "next/link";
import QuestionnaireForm from "./form";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Questionnaire is members-only: the invite gate. Session is checked by
 * middleware; membership is checked here and in the API route.
 */
export async function QuestionnaireGate() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const telegramId =
    secret && token ? (await verifySessionToken(token, secret))?.telegramId ?? null : null;

  let isMember = false;
  if (telegramId) {
    try {
      const supabase = await createSupabaseServerClient();
      const profile = await getProfileByTelegramId(supabase, telegramId);
      isMember = profile?.is_member ?? false;
    } catch {
      isMember = false;
    }
  }

  if (!isMember) {
    return (
      <main className="centered">
        <div className="card narrow">
          <div className="eyebrow">Questionnaire</div>
          <h1>Members only</h1>
          <p className="muted">
            The questionnaire is for vouched members. Claim an invite from a
            friend first — then come back and tell us about yourself.
          </p>
          <p className="muted small">
            <Link href="/">← Back home</Link>
          </p>
        </div>
      </main>
    );
  }

  return <QuestionnaireForm />;
}
