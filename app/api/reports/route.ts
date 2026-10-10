import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/botNotify";
import { logEvent } from "@/lib/events";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile || !profile.is_member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (!category) {
    return NextResponse.json({ error: "missing_category" }, { status: 400 });
  }

  const matchId = typeof body.match_id === "string" ? body.match_id.trim() : null;
  let reportedProfileId =
    typeof body.reported_profile_id === "string" ? body.reported_profile_id.trim() : null;

  // If match_id is provided, verify participant access and infer reported profile
  if (matchId) {
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, a_id, b_id")
      .eq("id", matchId)
      .maybeSingle();

    if (matchErr) return NextResponse.json({ error: "db_error" }, { status: 500 });
    if (!match) return NextResponse.json({ error: "match_not_found" }, { status: 404 });

    if (profile.id !== match.a_id && profile.id !== match.b_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const partnerId = match.a_id === profile.id ? match.b_id : match.a_id;
    if (!reportedProfileId) {
      reportedProfileId = partnerId;
    } else if (reportedProfileId !== partnerId) {
      return NextResponse.json({ error: "invalid_reported_profile" }, { status: 400 });
    }
  }

  if (!reportedProfileId) {
    return NextResponse.json({ error: "missing_reported_profile" }, { status: 400 });
  }

  const details = typeof body.details === "string" ? body.details.trim().slice(0, 4000) : null;

  // Idempotency check on (reporter, match, category)
  let existingQuery = supabase
    .from("safety_reports")
    .select("id, status")
    .eq("reporter_profile_id", profile.id)
    .eq("category", category);

  if (matchId) {
    existingQuery = existingQuery.eq("match_id", matchId);
  } else {
    existingQuery = existingQuery.is("match_id", null);
  }

  const { data: existingReport } = await existingQuery.maybeSingle();
  if (existingReport) {
    return NextResponse.json({ ok: true, report_id: existingReport.id, duplicate: true });
  }

  const { data: created, error: insErr } = await supabase
    .from("safety_reports")
    .insert({
      reporter_profile_id: profile.id,
      reported_profile_id: reportedProfileId,
      match_id: matchId,
      category,
      details,
      status: "open",
    })
    .select("id")
    .single();

  if (insErr || !created) {
    return NextResponse.json({ error: "db_error", details: insErr?.message }, { status: 500 });
  }

  await logEvent({
    supabase,
    eventType: "safety_report_filed",
    actorProfileId: profile.id,
    matchId,
    targetId: created.id,
    metadata: { category, reported_profile_id: reportedProfileId },
  });

  // Telegram instant alert to founders
  try {
    const { data: founders } = await supabase
      .from("profiles")
      .select("telegram_id")
      .eq("is_founder", true);

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me").replace(
      /\/$/,
      ""
    );
    const alertMsg = `Safety report filed: category '${category}'. Review report in founder admin: ${baseUrl}/admin/safety`;

    for (const f of founders ?? []) {
      if (f.telegram_id) {
        await sendTelegramMessage(Number(f.telegram_id), alertMsg).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[safety] Failed to notify founders:", err);
  }

  return NextResponse.json({ ok: true, report_id: created.id });
}
