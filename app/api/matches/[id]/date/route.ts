import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/botNotify";
import { logEvent } from "@/lib/events";
import { computeDateTransition, type DateAction, type MatchDateRecord } from "@/lib/matchDates";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

async function requireParticipant(
  req: NextRequest,
  params: Promise<{ id: string }>
) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) return { error: "unauthenticated" as const, status: 401 };

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile || !profile.is_member) return { error: "forbidden" as const, status: 403 };

  const { id: matchId } = await params;
  if (!matchId) return { error: "missing_id" as const, status: 400 };

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, status, a_id, b_id")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) return { error: "db_error" as const, status: 500 };
  if (!match) return { error: "match_not_found" as const, status: 404 };

  if (profile.id !== match.a_id && profile.id !== match.b_id) {
    return { error: "forbidden" as const, status: 403 };
  }

  return { supabase, profile, match };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireParticipant(req, params);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: dateRow } = await auth.supabase
    .from("match_dates")
    .select("match_id, status, scheduled_at, checked_in_at")
    .eq("match_id", auth.match.id)
    .maybeSingle();

  return NextResponse.json({
    date: dateRow ?? {
      match_id: auth.match.id,
      status: "not_planned",
      scheduled_at: null,
      checked_in_at: null,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleDateMutation(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleDateMutation(req, params);
}

async function handleDateMutation(
  req: NextRequest,
  params: Promise<{ id: string }>
) {
  const auth = await requireParticipant(req, params);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase, profile, match } = auth;
  if (match.status !== "accepted") {
    return NextResponse.json({ error: "match_not_accepted" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Determine DateAction
  let action: DateAction;
  const statusParam = (body.status ?? body.action) as string | undefined;

  if (statusParam === "schedule" || (statusParam === "scheduled" && body.scheduled_at)) {
    const scheduledAt = String(body.scheduled_at ?? body.scheduledAt ?? "");
    if (!scheduledAt) {
      return NextResponse.json({ error: "missing_scheduled_at" }, { status: 400 });
    }
    action = { type: "schedule", scheduledAt };
  } else if (
    statusParam === "happened" ||
    statusParam === "skipped" ||
    statusParam === "not_planned"
  ) {
    action = { type: "check_in", status: statusParam };
  } else {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { data: existingDate } = await supabase
    .from("match_dates")
    .select("match_id, status, scheduled_at, checked_in_at")
    .eq("match_id", match.id)
    .maybeSingle();

  const transition = computeDateTransition(existingDate as MatchDateRecord | null, action);

  const { error: upsertErr } = await supabase.from("match_dates").upsert(
    {
      match_id: match.id,
      status: transition.nextStatus,
      scheduled_at: transition.scheduledAt,
      checked_in_at: transition.checkedInAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_id" }
  );

  if (upsertErr) {
    return NextResponse.json({ error: "db_error", details: upsertErr.message }, { status: 500 });
  }

  // Notify partner if date was scheduled
  if (transition.notifyPartnerText) {
    const partnerId = match.a_id === profile.id ? match.b_id : match.a_id;
    const { data: partnerProfile } = await supabase
      .from("profiles")
      .select("telegram_id")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerProfile?.telegram_id) {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me").replace(
        /\/$/,
        ""
      );
      const text = `${transition.notifyPartnerText}${baseUrl}/matches`;
      try {
        await sendTelegramMessage(Number(partnerProfile.telegram_id), text);
      } catch (err) {
        console.error(`[botNotify] failed to notify partner of scheduled date:`, err);
      }
    }
  }

  await logEvent({
    supabase,
    eventType: `date_${transition.nextStatus}`,
    actorProfileId: profile.id,
    matchId: match.id,
    targetId: `${match.id}:${transition.nextStatus}`,
    metadata: {
      status: transition.nextStatus,
      scheduled_at: transition.scheduledAt,
    },
  });

  return NextResponse.json({
    ok: true,
    status: transition.nextStatus,
    scheduled_at: transition.scheduledAt,
    checked_in_at: transition.checkedInAt,
  });
}
