import type { Importance } from "@/lib/questionnaire";

export type CycleAnswers = {
  identity: string;
  interests: string[];
  chronotype: string;
  recharge: string;
  conflict: string;
  diet: string;
  smokes: string;
  kids: string;
  religion?: string;
  seeking: string;
  age_bracket: string;
  age_min: string;
  age_max: string;
  green_flags: string[];
  diet_pref?: string;
  smoking_pref: string;
  kids_pref: string;
  energy_pref: string;
  texting_pref: string;
  religion_pref?: string;
  importance: Record<string, Importance>;
};

export type CycleParticipant = {
  id: string;
  answers: CycleAnswers;
};

export type ScoredPair = {
  aId: string;
  bId: string;
  aScore: number;
  bScore: number;
  mutualScore: number;
  ageFilterSkipped: boolean;
};

export type CycleResult = {
  pairs: ScoredPair[];
  unmatched: string[];
  algorithm: "stable-roommates" | "greedy-fallback";
  eligiblePairCount: number;
  ageFilterSkippedMemberIds: string[];
  excludedPairCounts: Record<string, number>;
};

const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  must_have: 3,
  important: 2,
  nice_to_have: 1,
};

function set(values: string[] | undefined): Set<string> {
  return new Set(values ?? []);
}

function overlap(a: string[], b: string[]): number {
  const left = set(a);
  const right = set(b);
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;
  return [...left].filter((value) => right.has(value)).length / new Set([...left, ...right]).size;
}

function importance(answers: CycleAnswers, key: string): number {
  return IMPORTANCE_WEIGHT[answers.importance[key] ?? "important"];
}

/**
 * Validates whether candidate's identity matches seeker's preference.
 * - 'everyone' matches all identities (man, woman, nonbinary, prefer_not).
 * - 'men' matches only 'man'.
 * - 'women' matches only 'woman'.
 * Non-binary and prefer-not-to-say identities match only with seekers looking
 * for 'everyone', ensuring reciprocal satisfaction without binary gender coercion.
 */
export function seekingIncludes(seeking: string, identity: string): boolean {
  if (seeking === "everyone") {
    return ["man", "woman", "nonbinary", "prefer_not"].includes(identity) || Boolean(identity);
  }
  if (seeking === "men") return identity === "man";
  if (seeking === "women") return identity === "woman";
  return false;
}

function smokingCompatible(preference: string, smoking: string): boolean {
  if (preference === "hard_no") return smoking === "no";
  if (preference === "socially_ok") return smoking === "no" || smoking === "socially";
  return true;
}

function kidsCompatible(preference: string, kids: string, ownKids: string): boolean {
  if (preference !== "aligned") return true;
  return ["yes", "open", "unsure"].includes(kids) === ["yes", "open", "unsure"].includes(ownKids);
}

function energyValue(answers: CycleAnswers): number {
  return answers.recharge === "social" ? 1 : answers.recharge === "alone" || answers.recharge === "sleep" ? 0 : 0.5;
}

function energyCompatible(preference: string, candidate: CycleAnswers, seeker: CycleAnswers): boolean {
  if (preference === "doesnt_matter") return true;
  const same = Math.abs(energyValue(candidate) - energyValue(seeker)) < 0.51;
  return preference === "same" ? same : !same;
}

/**
 * Coarse age brackets keep exact age private while still allowing the
 * age_min/age_max preference range to filter. Overlap (not containment)
 * is the rule: a 25–29 candidate overlaps a seeker wanting 21–40.
 */
const AGE_BRACKETS: Record<string, [number, number]> = {
  age_18_24: [18, 24],
  age_25_29: [25, 29],
  age_30_34: [30, 34],
  age_35_39: [35, 39],
  age_40_plus: [40, 120],
};

function ageCompatible(
  seeker: CycleParticipant,
  candidate: CycleParticipant
): { ok: boolean; skipped: boolean } {
  const bracket = AGE_BRACKETS[candidate.answers.age_bracket];
  if (!bracket) return { ok: true, skipped: true };
  const min = Number(seeker.answers.age_min);
  const max = Number(seeker.answers.age_max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ok: true, skipped: true };
  const [lo, hi] = bracket;
  return { ok: lo <= max && hi >= min, skipped: false };
}

export function dietCompatible(aDiet?: string, bDiet?: string): boolean {
  const a = aDiet ?? "none";
  const b = bDiet ?? "none";
  return a === "none" || b === "none" || a === b;
}

export function religionCompatible(seekerPref?: string, candidateReligion?: string): boolean {
  if (!seekerPref || seekerPref === "doesnt_matter" || seekerPref === "prefer_not_to_say") {
    return true;
  }
  if (!candidateReligion || candidateReligion === "prefer_not_to_say") {
    return true;
  }
  return seekerPref === candidateReligion;
}

/**
 * Track B must-haves are hard filters. Age uses coarse brackets (privacy):
 * the candidate's bracket must overlap the seeker's preferred range.
 */
export function passesHardFilters(a: CycleParticipant, b: CycleParticipant): { ok: boolean; ageSkipped: boolean; reasons: string[] } {
  const age = ageCompatible(a, b);
  const reasons: string[] = [];
  if (!age.ok) reasons.push("age_range");
  if (!seekingIncludes(a.answers.seeking, b.answers.identity)) reasons.push("identity_seeking");

  const aImportance = a.answers.importance;
  if ((aImportance.diet === "must_have" || aImportance.diet_pref === "must_have") && !dietCompatible(a.answers.diet, b.answers.diet)) {
    reasons.push("must_have_diet");
  }
  if (aImportance.religion_pref === "must_have" && !religionCompatible(a.answers.religion_pref, b.answers.religion)) {
    reasons.push("must_have_religion");
  }
  if (aImportance.smoking_pref === "must_have" && !smokingCompatible(a.answers.smoking_pref, b.answers.smokes)) {
    reasons.push("must_have_smoking");
  }
  if (aImportance.kids_pref === "must_have" && !kidsCompatible(a.answers.kids_pref, b.answers.kids, a.answers.kids)) {
    reasons.push("must_have_kids");
  }
  if (aImportance.energy_pref === "must_have" && !energyCompatible(a.answers.energy_pref, b.answers, a.answers)) {
    reasons.push("must_have_energy");
  }
  return { ok: reasons.length === 0, ageSkipped: age.skipped, reasons };
}

function alignment(a: string, b: string): number {
  return a === b ? 1 : 0;
}

function smokingScore(preference: string, smoking: string): number {
  if (preference === "hard_no") return smoking === "no" ? 1 : 0;
  if (preference === "socially_ok") return smoking === "no" ? 1 : smoking === "socially" ? 0.75 : 0.25;
  return 0.8;
}

function kidsScore(preference: string, kids: string, ownKids: string): number {
  if (preference === "doesnt_matter") return 0.8;
  if (preference !== "aligned") return 0.5;
  const sameDirection = ["yes", "open", "unsure"].includes(kids) === ["yes", "open", "unsure"].includes(ownKids);
  return sameDirection ? 1 : 0;
}

function textingScore(preference: string, candidatePreference: string): number {
  if (preference === candidatePreference) return 1;
  if (preference === "checkins" || candidatePreference === "checkins") return 0.6;
  return 0.25;
}

/** Directional score from seeker to candidate, normalized to 0..100. */
export function directionalScore(seeker: CycleParticipant, candidate: CycleParticipant): number {
  const a = seeker.answers;
  const b = candidate.answers;
  const dimensions: Array<[number, number]> = [
    [overlap(a.interests, b.interests), importance(a, "green_flags")],
    [alignment(a.chronotype, b.chronotype), importance(a, "green_flags")],
    [alignment(a.recharge, b.recharge), importance(a, "energy_pref")],
    [alignment(a.conflict, b.conflict), importance(a, "green_flags")],
    [dietCompatible(a.diet, b.diet) ? 1 : 0, importance(a, a.importance?.diet_pref ? "diet_pref" : a.importance?.diet ? "diet" : "green_flags")],
    [smokingScore(a.smoking_pref, b.smokes), importance(a, "smoking_pref")],
    [kidsScore(a.kids_pref, b.kids, a.kids), importance(a, "kids_pref")],
    [a.energy_pref === "doesnt_matter" ? 0.8 : energyCompatible(a.energy_pref, b, a) ? 1 : 0, importance(a, "energy_pref")],
    [textingScore(a.texting_pref, b.texting_pref), importance(a, "texting_pref")],
  ];
  if (a.religion_pref && a.religion_pref !== "doesnt_matter") {
    dimensions.push([
      religionCompatible(a.religion_pref, b.religion) ? 1 : 0,
      importance(a, "religion_pref"),
    ]);
  }
  const totalWeight = dimensions.reduce((sum, [, weight]) => sum + weight, 0);
  const weighted = dimensions.reduce((sum, [value, weight]) => sum + value * weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function buildPairs(participants: CycleParticipant[]): { pairs: ScoredPair[]; ageSkippedIds: Set<string>; excludedPairCounts: Record<string, number> } {
  const pairs: ScoredPair[] = [];
  const ageSkippedIds = new Set<string>();
  const excludedPairCounts: Record<string, number> = {};
  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const a = participants[i];
      const b = participants[j];
      const ab = passesHardFilters(a, b);
      const ba = passesHardFilters(b, a);
      if (ab.ageSkipped || ba.ageSkipped) {
        ageSkippedIds.add(a.id);
        ageSkippedIds.add(b.id);
      }
      if (!ab.ok || !ba.ok) {
        for (const reason of [...ab.reasons, ...ba.reasons]) excludedPairCounts[reason] = (excludedPairCounts[reason] ?? 0) + 1;
        continue;
      }
      const aScore = directionalScore(a, b);
      const bScore = directionalScore(b, a);
      pairs.push({ aId: a.id, bId: b.id, aScore, bScore, mutualScore: (aScore + bScore) / 2, ageFilterSkipped: ab.ageSkipped || ba.ageSkipped });
    }
  }
  return { pairs, ageSkippedIds, excludedPairCounts };
}

type Lists = Record<string, string[]>;

function removePair(lists: Lists, a: string, b: string): void {
  lists[a] = (lists[a] ?? []).filter((id) => id !== b);
  lists[b] = (lists[b] ?? []).filter((id) => id !== a);
}

function prefers(lists: Lists, person: string, left: string, right: string): boolean {
  return (lists[person] ?? []).indexOf(left) < (lists[person] ?? []).indexOf(right);
}

/** Irving's stable-roommates algorithm. Returns null when no stable matching exists. */
export function irving(preferences: Lists): Record<string, string> | null {
  const lists: Lists = Object.fromEntries(Object.entries(preferences).map(([id, values]) => [id, [...values]]));
  const ids = Object.keys(lists).sort();
  const heldBy: Record<string, string> = {};
  const free = [...ids];

  while (free.length > 0) {
    const proposer = free.shift()!;
    const receiver = lists[proposer]?.[0];
    if (!receiver) return null;
    const current = heldBy[receiver];
    if (current && prefers(lists, receiver, proposer, current)) {
      removePair(lists, receiver, current);
      free.push(current);
    } else if (current) {
      removePair(lists, proposer, receiver);
      free.push(proposer);
      continue;
    }
    heldBy[receiver] = proposer;
    const receiverList = lists[receiver] ?? [];
    const proposerIndex = receiverList.indexOf(proposer);
    for (const rejected of receiverList.slice(proposerIndex + 1)) removePair(lists, receiver, rejected);
  }

  while (true) {
    const person = ids.find((id) => (lists[id]?.length ?? 0) > 1);
    if (!person) break;
    const first = lists[person][0];
    const worst = lists[first][lists[first].length - 1];
    removePair(lists, first, worst);
    if (!lists[first]?.length || !lists[worst]?.length) return null;
  }

  const result: Record<string, string> = {};
  for (const id of ids) {
    const partner = lists[id]?.[0];
    if (!partner || lists[partner]?.[0] !== id) return null;
    result[id] = partner;
  }
  return result;
}

export function greedyMaxWeightMatching(pairs: ScoredPair[]): ScoredPair[] {
  const used = new Set<string>();
  return [...pairs]
    .sort((left, right) => right.mutualScore - left.mutualScore || pairKey(left.aId, left.bId).localeCompare(pairKey(right.aId, right.bId)))
    .filter((pair) => {
      if (used.has(pair.aId) || used.has(pair.bId)) return false;
      used.add(pair.aId);
      used.add(pair.bId);
      return true;
    });
}

export function runCycle(participants: CycleParticipant[]): CycleResult {
  const { pairs, ageSkippedIds, excludedPairCounts } = buildPairs(participants);
  const preferences: Lists = Object.fromEntries(participants.map((person) => [person.id, []]));
  for (const person of participants) {
    preferences[person.id] = pairs
      .filter((pair) => pair.aId === person.id || pair.bId === person.id)
      .map((pair) => ({ id: pair.aId === person.id ? pair.bId : pair.aId, score: pair.mutualScore }))
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .map(({ id }) => id);
  }
  const stable = irving(preferences);
  const selected = stable
    ? pairs.filter((pair) => stable[pair.aId] === pair.bId || stable[pair.bId] === pair.aId)
    : greedyMaxWeightMatching(pairs);
  const matched = new Set(selected.flatMap((pair) => [pair.aId, pair.bId]));
  return {
    pairs: selected,
    unmatched: participants.map((person) => person.id).filter((id) => !matched.has(id)).sort(),
    algorithm: stable ? "stable-roommates" : "greedy-fallback",
    eligiblePairCount: pairs.length,
    ageFilterSkippedMemberIds: [...ageSkippedIds].sort(),
    excludedPairCounts,
  };
}

export function canonicalPairKey(aId: string, bId: string): string {
  return pairKey(aId, bId);
}
