import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/adminAuth";
import { computeFounderMetrics } from "@/lib/events";

export async function GET(req: NextRequest) {
  const auth = await requireFounder(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase } = auth;
  const since = req.nextUrl.searchParams.get("since");

  // 1. Funnel counts
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, is_member");
  if (profErr) {
    return NextResponse.json({ error: "db_error", details: profErr.message }, { status: 500 });
  }

  const { count: questionnairesCount, error: qErr } = await supabase
    .from("questionnaire_responses")
    .select("profile_id", { count: "exact", head: true });
  if (qErr) {
    return NextResponse.json({ error: "db_error", details: qErr.message }, { status: 500 });
  }

  const profilesCount = profiles?.length ?? 0;
  const membersCount = (profiles ?? []).filter((p: any) => p.is_member).length;

  // 2. Matches
  let matchQuery = supabase.from("matches").select("id, status, accepted_at, created_at");
  if (since) {
    matchQuery = matchQuery.gte("created_at", since);
  }
  const { data: matches, error: matchErr } = await matchQuery;
  if (matchErr) {
    return NextResponse.json({ error: "db_error", details: matchErr.message }, { status: 500 });
  }

  // 3. Feedback
  let fbQuery = supabase.from("match_feedback").select("id, would_meet_again, submitted_at");
  if (since) {
    fbQuery = fbQuery.gte("submitted_at", since);
  }
  const { data: feedback } = await fbQuery;

  // 4. Dates (safe fallback if match_dates not yet applied)
  let dates: Array<{ status: string }> = [];
  try {
    const { data: dateRows } = await supabase.from("match_dates").select("status");
    if (dateRows) dates = dateRows;
  } catch {
    // match_dates table might be in subsequent migration
  }

  // 5. Reports (safe fallback if safety_reports not yet applied)
  let reportsCount = 0;
  try {
    const { count } = await supabase
      .from("safety_reports")
      .select("id", { count: "exact", head: true });
    if (count !== null) reportsCount = count;
  } catch {
    // safety_reports table might be in subsequent migration
  }

  // 6. Cycles
  const { data: cycles } = await supabase
    .from("match_cycles")
    .select("id, started_at, audit")
    .order("started_at", { ascending: false })
    .limit(10);

  const metrics = computeFounderMetrics({
    profilesCount,
    membersCount,
    questionnairesCount: questionnairesCount ?? 0,
    matches: matches ?? [],
    feedback: feedback ?? [],
    dates,
    reportsCount,
    cycles: cycles ?? [],
  });

  return NextResponse.json(metrics);
}
