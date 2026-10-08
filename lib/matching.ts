/**
 * Gale-Shapley stable matching engine for PairPeers.
 *
 * Pipeline:
 *   questionnaire answers -> compatibility scores -> ranked preference
 *   lists -> deferred acceptance (Gale-Shapley) -> stable pairs
 *
 * Stability means: no two people would both rather be with each other than
 * with their assigned partner. It does NOT mean "happiest" — it means no
 * mutually-preferred deviation exists.
 */

/** Describes a person (from their questionnaire answers). */
export interface Traits {
  age?: number;
  interests?: string[];
  greenFlags?: string[]; // values they embody / look for
  loveLanguages?: string[];
  socialEnergy?: number; // 0 (homebody) .. 1 (life of the party)
  travelFreq?: number; // 0 (never) .. 1 (constantly)
  nightOwl?: boolean;
  kids?: "yes" | "open" | "unsure" | "probably_not" | "no";
  religion?: string;
  diet?: string;
  smokes?: boolean;
}

/** Describes what a person wants (preferences + dealbreakers). */
export interface Wants {
  minAge?: number;
  maxAge?: number;
  interests?: string[];
  greenFlags?: string[];
  loveLanguages?: string[];
  socialEnergy?: number;
  travelFreq?: number;
  nightOwl?: boolean;
  kids?: Traits["kids"];
  religion?: string;
  diet?: string;
  /** Hard dealbreakers: "smoking" | "religion" | "diet" */
  dealbreakers?: string[];
}

export interface Participant {
  id: string;
  traits: Traits;
  wants: Wants;
}

/** Preference lists: participant id -> partner ids, best first. */
export type Preferences = Record<string, string[]>;

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0.5;
  const intersection = [...a].filter((x) => b.has(x)).length;
  return intersection / new Set([...a, ...b]).size;
}

const KIDS_SCORE: Record<string, number> = {
  yes: 2,
  open: 1,
  unsure: 1,
  probably_not: 0,
  no: 0,
};

/**
 * How much `seeker` would like `candidate`, in [0, 1].
 * Returns -Infinity when a hard dealbreaker is hit (unacceptable partner).
 */
export function compatibility(seeker: Participant, candidate: Participant): number {
  const t = candidate.traits;
  const w = seeker.wants;

  // ---- hard dealbreakers ----
  const dealbreakers = new Set(w.dealbreakers ?? []);
  if (dealbreakers.has("smoking") && t.smokes) return -Infinity;
  if (dealbreakers.has("religion") && t.religion !== w.religion) return -Infinity;
  if (dealbreakers.has("diet") && t.diet !== w.diet) return -Infinity;

  // ---- age range ----
  if (t.age !== undefined && !( (w.minAge ?? 0) <= t.age && t.age <= (w.maxAge ?? 99) )) {
    return -Infinity;
  }

  // ---- kids alignment ----
  const ks = KIDS_SCORE[w.kids ?? "unsure"] ?? 1;
  const kc = KIDS_SCORE[t.kids ?? "unsure"] ?? 1;
  if (Math.abs(ks - kc) === 2) return -Infinity; // "yes" vs "no": unacceptable

  // ---- soft scoring (weighted) ----
  let score = 0;
  let weight = 0;
  const add = (value: number, wt: number) => {
    score += value * wt;
    weight += wt;
  };

  add(jaccard(new Set(w.interests ?? []), new Set(t.interests ?? [])), 3);
  add(jaccard(new Set(w.greenFlags ?? []), new Set(t.greenFlags ?? [])), 3);
  add(jaccard(new Set(w.loveLanguages ?? []), new Set(t.loveLanguages ?? [])), 2);
  add(1 - Math.abs((w.socialEnergy ?? 0.5) - (t.socialEnergy ?? 0.5)), 2);
  add(1 - Math.abs((w.travelFreq ?? 0.5) - (t.travelFreq ?? 0.5)), 1);
  add(w.nightOwl === t.nightOwl ? 1 : 0.4, 1);
  add(1 - Math.abs(ks - kc) / 2, 2);

  return weight === 0 ? 0 : Math.round((score / weight) * 1000) / 1000;
}

/** Build ranked preference lists for both groups (best first, unacceptable excluded). */
export function buildPreferences(
  groupA: Participant[],
  groupB: Participant[]
): { prefsA: Preferences; prefsB: Preferences } {
  const prefsA: Preferences = {};
  for (const a of groupA) {
    prefsA[a.id] = groupB
      .filter((b) => compatibility(a, b) > -Infinity)
      .sort((x, y) => compatibility(a, y) - compatibility(a, x))
      .map((b) => b.id);
  }

  const prefsB: Preferences = {};
  for (const b of groupB) {
    prefsB[b.id] = groupA
      .filter((a) => compatibility(b, a) > -Infinity)
      .sort((x, y) => compatibility(b, y) - compatibility(b, x))
      .map((a) => a.id);
  }

  return { prefsA, prefsB };
}

/**
 * Deferred acceptance. Returns { proposerId: reviewerId }.
 * Proposer-optimal: every proposer gets the best partner achievable
 * in ANY stable matching. Swap the roles to favour the other side.
 */
export function galeShapley(
  proposers: string[],
  reviewers: string[],
  prefs: Preferences
): Record<string, string> {
  const rank: Record<string, Record<string, number>> = {};
  for (const r of reviewers) {
    rank[r] = {};
    (prefs[r] ?? []).forEach((p, i) => {
      rank[r][p] = i;
    });
  }

  const nextIdx: Record<string, number> = Object.fromEntries(proposers.map((p) => [p, 0]));
  const engaged: Record<string, string> = {}; // reviewer -> proposer
  const free = [...proposers];

  while (free.length > 0) {
    const p = free.shift()!;
    const list = prefs[p] ?? [];
    if (nextIdx[p] >= list.length) continue; // exhausted list: stays unmatched
    const r = list[nextIdx[p]++];
    const current = engaged[r];
    if (current === undefined) {
      engaged[r] = p;
    } else if ((rank[r][p] ?? Infinity) < (rank[r][current] ?? Infinity)) {
      free.push(current); // dumped proposer tries their next choice
      engaged[r] = p;
    } else {
      free.push(p); // rejected: propose to next choice
    }
  }

  return Object.fromEntries(Object.entries(engaged).map(([r, p]) => [p, r]));
}

/**
 * Verify stability: returns blocking pairs (pairs who would both prefer
 * each other over their assigned partners). Empty array = stable.
 */
export function checkStability(
  pairs: Record<string, string>,
  prefs: Preferences
): Array<[string, string]> {
  const partnerOf: Record<string, string> = {};
  for (const [p, r] of Object.entries(pairs)) {
    partnerOf[p] = r;
    partnerOf[r] = p;
  }

  const rank: Record<string, Record<string, number>> = {};
  for (const [x, list] of Object.entries(prefs)) {
    rank[x] = {};
    list.forEach((y, i) => {
      rank[x][y] = i;
    });
  }

  const blocking: Array<[string, string]> = [];
  for (const [p, r] of Object.entries(pairs)) {
    for (const alt of prefs[p] ?? []) {
      if (alt === r) break; // everyone after is worse for p
      const altPartner = partnerOf[alt];
      if (altPartner === undefined || (rank[alt]?.[p] ?? Infinity) < (rank[alt]?.[altPartner] ?? Infinity)) {
        blocking.push([p, alt]);
        break;
      }
    }
  }
  return blocking;
}

/**
 * Run one full matching cycle. Returns pairs plus anyone left unmatched
 * (re-queued for the next cycle with a fresh pool).
 */
export function runMatchingCycle(groupA: Participant[], groupB: Participant[]) {
  const { prefsA, prefsB } = buildPreferences(groupA, groupB);
  const prefs = { ...prefsA, ...prefsB };
  const pairs = galeShapley(
    groupA.map((p) => p.id),
    groupB.map((p) => p.id),
    prefs
  );
  const matchedB = new Set(Object.values(pairs));
  const unmatchedA = groupA.map((p) => p.id).filter((id) => !(id in pairs));
  const unmatchedB = groupB.map((p) => p.id).filter((id) => !matchedB.has(id));
  return { pairs, unmatchedA, unmatchedB, blocking: checkStability(pairs, prefs) };
}
