import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/botNotify";
import { logEvent } from "@/lib/events";
import { getProfileByTelegramId } from "@/lib/profiles";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  // Rate-limit by IP and profile
  const ip = clientIp(req);
  const ipLimiter = rateLimit(`appeal:ip:${ip}`, 5, 60_000);
  if (!ipLimiter.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Rate-limit by profile (works for banned and unbanned users)
  const profileLimiter = rateLimit(`appeal:profile:${profile.id}`, 3, 60_000);
  if (!profileLimiter.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5 || reason.length > 500) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }

  const details = typeof body?.details === "string" ? body.details.trim().slice(0, 4000) : null;
  const safetyReportId = typeof body?.safety_report_id === "string" ? body.safety_report_id : null;
  const matchBlockId = typeof body?.match_block_id === "string" ? body.match_block_id : null;

  // Idempotency: return existing pending or reviewing appeal if already filed
  const { data: existing } = await supabase
    .from("safety_appeals")
    .select("id, status")
    .eq("profile_id", profile.id)
    .in("status", ["pending", "reviewing"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, appeal_id: existing.id, duplicate: true });
  }

  const { data: created, error: insErr } = await supabase
    .from("safety_appeals")
    .insert({
      profile_id: profile.id,
      reason,
      details,
      safety_report_id: safetyReportId,
      match_block_id: matchBlockId,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !created) {
    return NextResponse.json({ error: "db_error", details: insErr?.message }, { status: 500 });
  }

  await logEvent({
    supabase,
    eventType: "safety_appeal_filed",
    actorProfileId: profile.id,
    targetId: created.id,
    metadata: { reason },
  });

  // Telegram instant alert to founders (same pattern as safety reports)
  try {
    const { data: founders } = await supabase
      .from("profiles")
      .select("telegram_id")
      .eq("is_founder", true);

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me").replace(
      /\/$/,
      ""
    );
    const alertMsg = `Safety appeal filed by ${profile.display_name ?? "Member"}: '${reason}'. Review in founder admin: ${baseUrl}/admin/safety`;

    for (const f of founders ?? []) {
      if (f.telegram_id) {
        await sendTelegramMessage(Number(f.telegram_id), alertMsg).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[appeals] Failed to notify founders:", err);
  }

  return NextResponse.json({ ok: true, appeal_id: created.id });
}
