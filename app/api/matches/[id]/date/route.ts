import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/botNotify";
import { logEvent } from "@/lib/events";
import {
  computeDateTransition,
  validateProposal,
  validateSelection,
  type DateAction,
  type MatchDateRecord,
} from "@/lib/matchDates";
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
    .select(
      "match_id, status, scheduled_at, checked_in_at, proposer_id, slot_1, slot_2, slot_3, venue_text, selected_slot, proposed_at, selected_at"
    )
    .eq("match_id", auth.match.id)
    .maybeSingle();

  const record = dateRow ?? {
    match_id: auth.match.id,
    status: "not_planned",
    scheduled_at: null,
    checked_in_at: null,
    proposer_id: null,
    slot_1: null,
    slot_2: null,
    slot_3: null,
    venue_text: null,
    selected_slot: null,
    proposed_at: null,
    selected_at: null,
  };

  return NextResponse.json({
    date: record,
    is_proposer: record.proposer_id === auth.profile.id,
    can_select: Boolean(record.proposer_id && record.proposer_id !== auth.profile.id),
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

  // Load existing match_date record
  const { data: existingDate } = await supabase
    .from("match_dates")
    .select(
      "match_id, status, scheduled_at, checked_in_at, proposer_id, slot_1, slot_2, slot_3, venue_text, selected_slot, proposed_at, selected_at"
    )
    .eq("match_id", match.id)
    .maybeSingle();

  const existingRecord = existingDate as MatchDateRecord | null;
  const actionParam = (body.action ?? body.type ?? body.status) as string | undefined;

  let action: DateAction;
  let eventType = "date_updated";

  if (actionParam === "propose") {
    const rawSlots = Array.isArray(body.slots)
      ? (body.slots as string[])
      : [body.slot_1, body.slot_2, body.slot_3].filter((s): s is string => typeof s === "string" && Boolean(s));

    const venue = typeof body.venue === "string" ? body.venue : typeof body.venue_text === "string" ? body.venue_text : null;
    const validation = validateProposal(rawSlots, venue);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    action = {
      type: "propose",
      proposerId: profile.id,
      slots: validation.slots,
      venueText: validation.venueText,
    };
    eventType = "date_proposed";
  } else if (actionParam === "select") {
    const selectedSlot = String(body.slot ?? body.selected_slot ?? "");
    if (!selectedSlot) {
      return NextResponse.json({ error: "missing_selected_slot" }, { status: 400 });
    }

    // Idempotent selection check: if already scheduled for this slot, return success
    if (
      existingRecord?.status === "scheduled" &&
      existingRecord.selected_slot &&
      new Date(existingRecord.selected_slot).getTime() === new Date(selectedSlot).getTime()
    ) {
      return NextResponse.json({
        ok: true,
        status: existingRecord.status,
        scheduled_at: existingRecord.scheduled_at,
        selected_slot: existingRecord.selected_slot,
      });
    }

    const validation = validateSelection(existingRecord, profile.id, selectedSlot);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    action = {
      type: "select",
      selectorId: profile.id,
      selectedSlot: validation.selectedSlot,
    };
    eventType = "date_scheduled";
  } else if (actionParam === "schedule" || (actionParam === "scheduled" && body.scheduled_at)) {
    const scheduledAt = String(body.scheduled_at ?? body.scheduledAt ?? "");
    if (!scheduledAt) {
      return NextResponse.json({ error: "missing_scheduled_at" }, { status: 400 });
    }
    action = { type: "schedule", scheduledAt };
    eventType = "date_scheduled";
  } else if (
    actionParam === "happened" ||
    actionParam === "skipped" ||
    actionParam === "not_planned"
  ) {
    action = { type: "check_in", status: actionParam };
    eventType = `date_${actionParam}`;
  } else {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const transition = computeDateTransition(existingRecord, action);

  const { error: upsertErr } = await supabase.from("match_dates").upsert(
    {
      match_id: match.id,
      status: transition.nextStatus,
      scheduled_at: transition.scheduledAt,
      checked_in_at: transition.checkedInAt,
      proposer_id: transition.proposerId,
      slot_1: transition.slot1,
      slot_2: transition.slot2,
      slot_3: transition.slot3,
      venue_text: transition.venueText,
      selected_slot: transition.selectedSlot,
      proposed_at: transition.proposedAt,
      selected_at: transition.selectedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_id" }
  );

  if (upsertErr) {
    return NextResponse.json({ error: "db_error", details: upsertErr.message }, { status: 500 });
  }

  // Notify partner on proposal or selection/schedule
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
        console.error(`[botNotify] failed to notify partner of date event:`, err);
      }
    }
  }

  await logEvent({
    supabase,
    eventType,
    actorProfileId: profile.id,
    matchId: match.id,
    targetId: `${match.id}:${transition.nextStatus}`,
    metadata: {
      status: transition.nextStatus,
      scheduled_at: transition.scheduledAt,
      selected_slot: transition.selectedSlot,
      venue_text: transition.venueText,
    },
  });

  return NextResponse.json({
    ok: true,
    status: transition.nextStatus,
    scheduled_at: transition.scheduledAt,
    checked_in_at: transition.checkedInAt,
    proposer_id: transition.proposerId,
    slot_1: transition.slot1,
    slot_2: transition.slot2,
    slot_3: transition.slot3,
    venue_text: transition.venueText,
    selected_slot: transition.selectedSlot,
  });
}
