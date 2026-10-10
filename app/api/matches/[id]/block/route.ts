import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { blockMatch } from "@/lib/matchBlocks";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id: matchId } = await params;
  if (!matchId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const result = await blockMatch(supabase, profile.id, matchId);
  if (!result.ok) {
    const status =
      result.error === "match_not_found"
        ? 404
        : result.error === "forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    partner_id: result.partner_id,
    duplicate: result.duplicate ?? false,
  });
}
