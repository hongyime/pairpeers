import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { createInvite } from "@/lib/invites";
import { ensureProfile } from "@/lib/profiles";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Creates an invite (authenticated members only).
 * Body: { vouch: string } — the written reference, required atomically.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`invites:create:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let vouch: unknown;
  try {
    ({ vouch } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof vouch !== "string") {
    return NextResponse.json({ error: "vouch_invalid" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  let profile;
  try {
    profile = await ensureProfile(supabase, telegramId, null);
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  let result;
  try {
    result = await createInvite(supabase, profile.id, profile.is_member, vouch);
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!result.ok) {
    const status =
      result.error === "not_member" ? 403
      : result.error === "quota_exhausted" ? 403
      : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  return NextResponse.json({
    ok: true,
    code: result.code,
    expires_at: result.expires_at,
    link: `${baseUrl}/invite/${result.code}`,
  });
}
