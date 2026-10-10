import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/adminAuth";
import { logEvent } from "@/lib/events";

export async function GET(req: NextRequest) {
  const auth = await requireFounder(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase } = auth;
  const statusFilter = req.nextUrl.searchParams.get("status");

  let query = supabase
    .from("safety_reports")
    .select(
      `
      id,
      category,
      details,
      status,
      resolution_notes,
      resolved_at,
      created_at,
      match_id,
      reporter:profiles!safety_reports_reporter_profile_id_fkey(id, display_name, telegram_username),
      reported:profiles!safety_reports_reported_profile_id_fkey(id, display_name, telegram_username, is_banned)
    `
    )
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: reports, error } = await query;
  if (error) {
    return NextResponse.json({ error: "db_error", details: error.message }, { status: 500 });
  }

  const { data: invites } = await supabase
    .from("invites")
    .select(`
      id,
      code,
      vouch_text,
      uses,
      max_uses,
      expires_at,
      created_at,
      inviter:profiles!invites_inviter_id_fkey(id, display_name, telegram_username, is_banned)
    `)
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ reports: reports ?? [], invites: invites ?? [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireFounder(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase, profile } = auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Direct profile ban / unban
  if (body.profile_id && (body.banned !== undefined || body.is_banned !== undefined)) {
    const profileId = String(body.profile_id);
    const shouldBan = Boolean(body.banned ?? body.is_banned);

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ is_banned: shouldBan })
      .eq("id", profileId);

    if (updErr) {
      return NextResponse.json({ error: "db_error", details: updErr.message }, { status: 500 });
    }

    await logEvent({
      supabase,
      eventType: shouldBan ? "profile_banned" : "profile_unbanned",
      actorProfileId: profile?.id ?? null,
      targetId: profileId,
      metadata: { reason: "admin_action", is_banned: shouldBan },
    });

    return NextResponse.json({ ok: true, profile_id: profileId, is_banned: shouldBan });
  }

  if (!body.report_id) {
    return NextResponse.json({ error: "missing_report_id" }, { status: 400 });
  }

  const reportId = String(body.report_id);
  const status = body.status as "open" | "reviewing" | "resolved" | "dismissed" | undefined;
  const resolutionNotes = typeof body.resolution_notes === "string" ? body.resolution_notes.trim() : undefined;
  const banProfile = body.ban_profile !== undefined ? Boolean(body.ban_profile) : undefined;

  // Check report exists
  const { data: report, error: repErr } = await supabase
    .from("safety_reports")
    .select("id, reported_profile_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (repErr) return NextResponse.json({ error: "db_error" }, { status: 500 });
  if (!report) return NextResponse.json({ error: "report_not_found" }, { status: 404 });

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (status) {
    patch.status = status;
    if (status === "resolved" || status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
      if (profile) patch.resolved_by = profile.id;
    }
  }

  if (resolutionNotes !== undefined) {
    patch.resolution_notes = resolutionNotes;
  }

  const { error: updErr } = await supabase
    .from("safety_reports")
    .update(patch)
    .eq("id", reportId);

  if (updErr) {
    return NextResponse.json({ error: "db_error", details: updErr.message }, { status: 500 });
  }

  // Handle profile ban if specified
  if (banProfile !== undefined && report.reported_profile_id) {
    const { error: banErr } = await supabase
      .from("profiles")
      .update({ is_banned: banProfile })
      .eq("id", report.reported_profile_id);

    if (banErr) {
      return NextResponse.json({ error: "db_error", details: banErr.message }, { status: 500 });
    }

    await logEvent({
      supabase,
      eventType: banProfile ? "profile_banned" : "profile_unbanned",
      actorProfileId: profile?.id ?? null,
      targetId: report.reported_profile_id,
      metadata: { reason: "safety_report_resolution", report_id: reportId, is_banned: banProfile },
    });
  }

  await logEvent({
    supabase,
    eventType: "safety_report_resolved",
    actorProfileId: profile?.id ?? null,
    targetId: reportId,
    metadata: { status: patch.status, ban_profile: banProfile },
  });

  return NextResponse.json({ ok: true, report_id: reportId, status: patch.status ?? report.status });
}
