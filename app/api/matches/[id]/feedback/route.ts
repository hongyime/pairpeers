import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    .select("id, status, a_id, b_id")
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

  if (match.status !== "accepted") {
    return NextResponse.json({ error: "match_not_accepted" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.would_meet_again !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 2000)
      : null;

  const { error: upsertErr } = await supabase.from("match_feedback").upsert(
    {
      match_id: match.id,
      profile_id: profile.id,
      would_meet_again: body.would_meet_again,
      note,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "match_id,profile_id" }
  );

  if (upsertErr) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
