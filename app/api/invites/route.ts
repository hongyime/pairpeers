import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { createInvite } from "@/lib/invites";
import { ensureProfile } from "@/lib/profiles";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getProfileByTelegramId } from "@/lib/profiles";
import { INVITES_PER_USER } from "@/lib/inviteConstants";

export async function GET(req: NextRequest) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfileByTelegramId(supabase, telegramId);
    if (!profile?.is_member) return NextResponse.json({ error: "not_member" }, { status: 403 });
    const { data, error } = await supabase.from("invites").select("code, vouch_text, expires_at, uses, max_uses, created_at").eq("inviter_id", profile.id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ invites: data ?? [], invitesLeft: Math.max(0, INVITES_PER_USER - (data ?? []).length) });
  } catch { return NextResponse.json({ error: "db_error" }, { status: 500 }); }
}

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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const vouch = body?.vouch;
  const relationshipLabel = body?.relationship_label ?? body?.relationship ?? body?.relationshipLabel;
  const voucherNameApproved = Boolean(body?.voucher_name_approved ?? body?.voucherNameApproved);

  if (typeof vouch !== "string") {
    return NextResponse.json({ error: "vouch_invalid" }, { status: 400 });
  }
  if (typeof relationshipLabel !== "string" || relationshipLabel.trim().length < 2) {
    return NextResponse.json({ error: "relationship_invalid" }, { status: 400 });
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
    result = await createInvite(
      supabase,
      profile.id,
      profile.is_member,
      vouch,
      relationshipLabel,
      voucherNameApproved
    );
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
