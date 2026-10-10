import { passesHardFilters, type CycleParticipant, type CycleAnswers } from "./matchingCycle.ts";

export type ParticipantInfo = {
  id: string;
  isExcluded?: boolean;
  exclusionReason?: string;
  answers?: Partial<CycleAnswers>;
};

export type CycleAuditSummary = {
  cycleId: string;
  startedAt: string;
  poolSize: number;
  eligiblePairCount: number;
  pairCount: number;
  algorithm: string | null;
  excludedCounts: Record<string, number>;
};

export type PoolMetrics = {
  eligiblePoolSize: number;
  totalParticipants: number;
  excludedCount: number;
  identityBuckets: Record<string, number>;
  seekingBuckets: Record<string, number>;
  identityShares: Record<string, number>;
  seekingShares: Record<string, number>;
  maxIdentityShare: number;
  dominantIdentityBucket: string | null;
  eligiblePairCount: number;
  pairRatio: number;
  warnings: string[];
  thresholds: {
    maxIdentityBucketShare: number; // 0.70
    minPairRatio: number; // 0.50
  };
  history: CycleAuditSummary[];
};

export const THRESHOLD_MAX_IDENTITY_SHARE = 0.7;
export const THRESHOLD_MIN_PAIR_RATIO = 0.5;

function defaultAnswers(patch: Partial<CycleAnswers> = {}): CycleAnswers {
  return {
    identity: "nonbinary",
    interests: [],
    chronotype: "in_between",
    recharge: "social",
    conflict: "talk_now",
    diet: "none",
    smokes: "no",
    kids: "open",
    seeking: "everyone",
    age_bracket: "age_25_29",
    age_min: "18",
    age_max: "99",
    green_flags: [],
    smoking_pref: "dont_mind",
    kids_pref: "doesnt_matter",
    energy_pref: "doesnt_matter",
    texting_pref: "checkins",
    importance: {},
    ...patch,
  };
}

export function computePoolMetrics(
  participants: ParticipantInfo[],
  history: CycleAuditSummary[] = []
): PoolMetrics {
  const totalParticipants = participants.length;
  const eligible = participants.filter((p) => !p.isExcluded && p.answers);
  const excludedCount = totalParticipants - eligible.length;
  const eligiblePoolSize = eligible.length;

  const identityBuckets: Record<string, number> = {
    man: 0,
    woman: 0,
    nonbinary: 0,
    prefer_not: 0,
  };

  const seekingBuckets: Record<string, number> = {
    men: 0,
    women: 0,
    everyone: 0,
  };

  for (const p of eligible) {
    const idVal = p.answers?.identity ?? "prefer_not";
    identityBuckets[idVal] = (identityBuckets[idVal] ?? 0) + 1;

    const seekVal = p.answers?.seeking ?? "everyone";
    seekingBuckets[seekVal] = (seekingBuckets[seekVal] ?? 0) + 1;
  }

  const identityShares: Record<string, number> = {};
  let maxIdentityShare = 0;
  let dominantIdentityBucket: string | null = null;

  for (const [bucket, count] of Object.entries(identityBuckets)) {
    const share = eligiblePoolSize > 0 ? count / eligiblePoolSize : 0;
    identityShares[bucket] = share;
    if (share > maxIdentityShare) {
      maxIdentityShare = share;
      dominantIdentityBucket = bucket;
    }
  }

  const seekingShares: Record<string, number> = {};
  for (const [bucket, count] of Object.entries(seekingBuckets)) {
    seekingShares[bucket] = eligiblePoolSize > 0 ? count / eligiblePoolSize : 0;
  }

  // Calculate eligible pairs among eligible participants
  const cycleParticipants: CycleParticipant[] = eligible.map((p) => ({
    id: p.id,
    answers: defaultAnswers(p.answers),
  }));

  let eligiblePairCount = 0;
  for (let i = 0; i < cycleParticipants.length; i++) {
    for (let j = i + 1; j < cycleParticipants.length; j++) {
      const a = cycleParticipants[i];
      const b = cycleParticipants[j];
      const ab = passesHardFilters(a, b);
      const ba = passesHardFilters(b, a);
      if (ab.ok && ba.ok) {
        eligiblePairCount++;
      }
    }
  }

  const pairRatio = eligiblePoolSize > 0 ? eligiblePairCount / eligiblePoolSize : 0;

  const warnings: string[] = [];

  // Alert default 1: warn when any single identity bucket exceeds 70% of the eligible pool
  if (eligiblePoolSize > 0 && maxIdentityShare > THRESHOLD_MAX_IDENTITY_SHARE && dominantIdentityBucket) {
    const pct = Math.round(maxIdentityShare * 100);
    warnings.push(
      `Identity skew detected: ${dominantIdentityBucket} represents ${pct}% of the eligible pool (monitor threshold: 70%)`
    );
  }

  // Alert default 2: warn when the eligible-pair ratio drops below 50% of participants
  if (eligiblePoolSize >= 2 && pairRatio < THRESHOLD_MIN_PAIR_RATIO) {
    const pct = Math.round(pairRatio * 100);
    warnings.push(
      `Low eligible-pair ratio: ${pct}% is below the 50% participant ratio threshold`
    );
  }

  return {
    eligiblePoolSize,
    totalParticipants,
    excludedCount,
    identityBuckets,
    seekingBuckets,
    identityShares,
    seekingShares,
    maxIdentityShare,
    dominantIdentityBucket,
    eligiblePairCount,
    pairRatio,
    warnings,
    thresholds: {
      maxIdentityBucketShare: THRESHOLD_MAX_IDENTITY_SHARE,
      minPairRatio: THRESHOLD_MIN_PAIR_RATIO,
    },
    history,
  };
}
