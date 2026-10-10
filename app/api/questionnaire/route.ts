import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { validateAnswers } from "@/lib/questionnaire";
import { logEvent } from "@/lib/events";

/**
 * Questionnaire persistence. Answers are stored in `questionnaire_responses`
 * keyed on the member's profile_id (one row per member, upserted).
 *
 * Defense in depth: the session is verified inside the handler, not only in
 * edge middleware, so a middleware matcher misconfiguration can never leave
 * this endpoint unprotected. Answers are tagged with the verified Telegram ID
 * via the profile lookup — the client never chooses whose answers these are.
 */
async function requireMember(req: NextRequest) {
  const sessionSecret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session =
    token && sessionSecret
      ? await verifySessionToken(token, sessionSecret)
      : null;
  if (!session) return { error: "unauthenticated" as const };

  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfileByTelegramId(supabase, session.telegramId);
    if (!profile?.is_member) return { error: "not_member" as const };
    return { supabase, profile };
  } catch {
    return { error: "db_error" as const };
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireMember(req);
  if ("error" in auth) {
    const status = auth.error === "unauthenticated" ? 401 : auth.error === "not_member" ? 403 : 500;
    return NextResponse.json({ error: auth.error }, { status });
  }

  const { data, error } = await auth.supabase
    .from("questionnaire_responses")
    .select("answers, updated_at")
    .eq("profile_id", auth.profile.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ answers: data?.answers ?? null });
}

export async function POST(req: NextRequest) {
  const auth = await requireMember(req);
  if ("error" in auth) {
    const status = auth.error === "unauthenticated" ? 401 : auth.error === "not_member" ? 403 : 500;
    return NextResponse.json({ error: auth.error }, { status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const payload =
    body && typeof body === "object" && "answers" in (body as Record<string, unknown>)
      ? (body as Record<string, unknown>).answers
      : body;

  const validated = validateAnswers(payload);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { error } = await auth.supabase.from("questionnaire_responses").upsert(
    {
      profile_id: auth.profile.id,
      answers: validated.answers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  await logEvent({
    supabase: auth.supabase,
    eventType: "questionnaire_completed",
    actorProfileId: auth.profile.id,
    targetId: auth.profile.id,
    metadata: { answers_count: Object.keys(validated.answers).length },
  });

  return NextResponse.json({ ok: true });
}

