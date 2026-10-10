import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/adminAuth";
import { computePoolMetrics, type ParticipantInfo, type CycleAuditSummary } from "@/lib/poolMetrics";

export async function GET(req: NextRequest) {
  const auth = await requireFounder(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase } = auth;

  // 1. Fetch profiles
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, is_member, is_banned");
  if (profErr) {
    return NextResponse.json({ error: "db_error", details: profErr.message }, { status: 500 });
  }

  // 2. Fetch questionnaire responses
  const { data: responses, error: respErr } = await supabase
    .from("questionnaire_responses")
    .select("profile_id, answers");
  if (respErr) {
    return NextResponse.json({ error: "db_error", details: respErr.message }, { status: 500 });
  }

  const responseMap = new Map<string, any>();
  for (const r of responses ?? []) {
    responseMap.set(r.profile_id, r.answers);
  }

  const participants: ParticipantInfo[] = (profiles ?? []).map((p: any) => {
    const answers = responseMap.get(p.id);
    const isExcluded = !p.is_member || Boolean(p.is_banned) || !answers;
    const exclusionReason = !p.is_member
      ? "not_a_member"
      : p.is_banned
      ? "banned"
      : !answers
      ? "incomplete_questionnaire"
      : undefined;

    return {
      id: p.id,
      isExcluded,
      exclusionReason,
      answers: answers ?? undefined,
    };
  });

  // 3. Fetch past cycles for historical audits
  const { data: cycles } = await supabase
    .from("match_cycles")
    .select("id, started_at, audit")
    .order("started_at", { ascending: false })
    .limit(10);

  const history: CycleAuditSummary[] = (cycles ?? []).map((c: any) => {
    const audit = (c.audit as any) ?? {};
    const pairs = audit.pairs ?? [];
    return {
      cycleId: c.id,
      startedAt: c.started_at,
      poolSize: audit.pool_size ?? 0,
      eligiblePairCount: audit.eligible_pair_count ?? 0,
      pairCount: pairs.length,
      algorithm: audit.algorithm_path ?? null,
      excludedCounts: audit.excluded_counts ?? {},
    };
  });

  const metrics = computePoolMetrics(participants, history);
  return NextResponse.json(metrics);
}
