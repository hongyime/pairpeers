export type LogEventParams = {
  supabase: any;
  eventType: string;
  actorProfileId?: string | null;
  matchId?: string | null;
  cycleId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, any>;
  occurredAt?: string;
  idempotencyKey?: string;
};

export type LogEventResult = {
  logged: boolean;
  skipped?: boolean;
  error?: unknown;
};

/**
 * Logs an append-only event to the events table.
 * Non-blocking: analytics failures are caught, logged to stderr, and never
 * bubble up to fail user-facing mutations.
 *
 * Default scoped idempotency key: `${actor}:${type}:${target}`.
 */
export async function logEvent(params: LogEventParams): Promise<LogEventResult> {
  try {
    const actor = params.actorProfileId ?? "system";
    const target = params.targetId ?? params.matchId ?? params.cycleId ?? "global";
    const idempotencyKey = params.idempotencyKey ?? `${actor}:${params.eventType}:${target}`;

    const { error } = await params.supabase.from("events").insert({
      event_type: params.eventType,
      actor_profile_id: params.actorProfileId ?? null,
      match_id: params.matchId ?? null,
      cycle_id: params.cycleId ?? null,
      occurred_at: params.occurredAt ?? new Date().toISOString(),
      metadata: params.metadata ?? {},
      idempotency_key: idempotencyKey,
    });

    if (error) {
      if (error.code === "23505" || error.message?.includes("duplicate key")) {
        return { logged: false, skipped: true };
      }
      console.error(`[events] Failed to log event ${params.eventType}:`, error);
      return { logged: false, error };
    }

    return { logged: true };
  } catch (err) {
    console.error(`[events] Unexpected exception logging event ${params.eventType}:`, err);
    return { logged: false, error: err };
  }
}

export type RawMetricsInput = {
  profilesCount: number;
  membersCount: number;
  questionnairesCount: number;
  matches: Array<{ id: string; status: string; accepted_at?: string | null }>;
  feedback: Array<{ id: string; would_meet_again: boolean }>;
  dates?: Array<{ status: string }>;
  reportsCount?: number;
  cycles?: Array<{ id: string; started_at: string; audit?: any }>;
};

export type FounderMetricsResult = {
  funnel: {
    totalProfiles: number;
    members: number;
    questionnaireCompleted: number;
    completionRate: number;
  };
  matches: {
    total: number;
    accepted: number;
    declined: number;
    expired: number;
    pending: number;
    resolved: number;
    acceptanceRate: number;
  };
  dates: {
    scheduled: number;
    happened: number;
    skipped: number;
    notPlanned: number;
  };
  feedback: {
    total: number;
    wouldMeetAgain: number;
    meetAgainRate: number;
    responseRate: number;
  };
  safety: {
    totalReports: number;
  };
  cycles: Array<{
    id: string;
    startedAt: string;
    poolSize: number;
    pairCount: number;
    algorithm: string | null;
  }>;
};

/**
 * Pure function to calculate founder dashboard metrics from raw records.
 */
export function computeFounderMetrics(input: RawMetricsInput): FounderMetricsResult {
  const completionRate =
    input.membersCount > 0 ? input.questionnairesCount / input.membersCount : 0;

  let accepted = 0;
  let declined = 0;
  let expired = 0;
  let pending = 0;

  for (const m of input.matches) {
    if (m.status === "accepted") accepted++;
    else if (m.status === "declined") declined++;
    else if (m.status === "expired") expired++;
    else pending++;
  }

  const resolved = accepted + declined + expired;
  const acceptanceRate = resolved > 0 ? accepted / resolved : 0;

  let scheduledDates = 0;
  let happenedDates = 0;
  let skippedDates = 0;
  let notPlannedDates = 0;

  for (const d of input.dates ?? []) {
    if (d.status === "scheduled") scheduledDates++;
    else if (d.status === "happened") happenedDates++;
    else if (d.status === "skipped") skippedDates++;
    else notPlannedDates++;
  }

  let wouldMeetAgain = 0;
  for (const f of input.feedback) {
    if (f.would_meet_again) wouldMeetAgain++;
  }

  const totalFeedback = input.feedback.length;
  const meetAgainRate = totalFeedback > 0 ? wouldMeetAgain / totalFeedback : 0;
  const maxPossibleFeedback = accepted * 2;
  const responseRate = maxPossibleFeedback > 0 ? totalFeedback / maxPossibleFeedback : 0;

  const cycles = (input.cycles ?? []).map((c) => {
    const audit = c.audit ?? {};
    const pairs = audit.pairs ?? [];
    return {
      id: c.id,
      startedAt: c.started_at,
      poolSize: audit.pool_size ?? 0,
      pairCount: pairs.length,
      algorithm: audit.algorithm_path ?? null,
    };
  });

  return {
    funnel: {
      totalProfiles: input.profilesCount,
      members: input.membersCount,
      questionnaireCompleted: input.questionnairesCount,
      completionRate,
    },
    matches: {
      total: input.matches.length,
      accepted,
      declined,
      expired,
      pending,
      resolved,
      acceptanceRate,
    },
    dates: {
      scheduled: scheduledDates,
      happened: happenedDates,
      skipped: skippedDates,
      notPlanned: notPlannedDates,
    },
    feedback: {
      total: totalFeedback,
      wouldMeetAgain,
      meetAgainRate,
      responseRate,
    },
    safety: {
      totalReports: input.reportsCount ?? 0,
    },
    cycles,
  };
}
