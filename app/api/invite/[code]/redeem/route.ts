import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { redeemInvite } from "@/lib/invites";
import { ensureProfile } from "@/lib/profiles";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { logEvent } from "@/lib/events";

/**
 * Redeems an invite for the authenticated Telegram identity.
 * Atomic via the `redeem_invite` Postgres function.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const rl = rateLimit(`invite:redeem:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  let profile;
  try {
    profile = await ensureProfile(supabase, telegramId, null);
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Private audit log: IP hash, never the raw IP.
  const ipHash = createHash("sha256").update(clientIp(req)).digest("hex");

  let result;
  try {
    result = await redeemInvite(supabase, code, profile.id, ipHash);
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!result.ok) {
    const status =
      result.error === "invalid_code" ? 404
      : result.error === "expired" ? 410
      : result.error === "banned_code" ? 403
      : result.error === "already_redeemed" ? 409
      : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  await logEvent({
    supabase,
    eventType: "invite_redeemed",
    actorProfileId: profile.id,
    targetId: code,
    metadata: { code_hash: ipHash },
  });

  return NextResponse.json({ ok: true });
}
