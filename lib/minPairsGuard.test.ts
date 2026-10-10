import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMinPairs,
  countCompatiblePairs,
  checkCompatiblePairsGuard,
  canonicalPairKey,
  type CycleAnswers,
  type CycleParticipant,
} from "./matchingCycle.ts";

const baseAnswers = (overrides: Partial<CycleAnswers> = {}): CycleAnswers => ({
  identity: "man",
  interests: ["reading", "hiking"],
  chronotype: "in_between",
  recharge: "social",
  conflict: "talk_now",
  diet: "none",
  smokes: "no",
  kids: "open",
  seeking: "everyone",
  age_bracket: "age_25_29",
  age_min: "21",
  age_max: "40",
  green_flags: ["kindness"],
  smoking_pref: "dont_mind",
  kids_pref: "doesnt_matter",
  energy_pref: "doesnt_matter",
  texting_pref: "checkins",
  importance: {
    seeking: "important",
    age_range: "important",
    green_flags: "important",
    smoking_pref: "important",
    kids_pref: "important",
    energy_pref: "important",
    texting_pref: "important",
  },
  ...overrides,
});

const person = (id: string, patch: Partial<CycleAnswers> = {}): CycleParticipant => ({
  id,
  answers: baseAnswers(patch),
});

test("invalid env values for MIN_PAIRS safely default to 2", () => {
  assert.equal(parseMinPairs(undefined), 2);
  assert.equal(parseMinPairs(null), 2);
  assert.equal(parseMinPairs(""), 2);
  assert.equal(parseMinPairs("0"), 2);
  assert.equal(parseMinPairs("-1"), 2);
  assert.equal(parseMinPairs("-10"), 2);
  assert.equal(parseMinPairs("not_a_number"), 2);
  assert.equal(parseMinPairs("NaN"), 2);

  // Valid positive integers are respected
  assert.equal(parseMinPairs("1"), 1);
  assert.equal(parseMinPairs("2"), 2);
  assert.equal(parseMinPairs("3"), 3);
  assert.equal(parseMinPairs("5"), 5);
});

test("heads above MIN_POOL (>= 6) but compatible pairs below MIN_PAIRS skips cycle", () => {
  // 6 heads in the pool (above typical MATCH_MIN_POOL of 6),
  // but only p1 and p2 are compatible with each other.
  // p3..p6 only seek a gender that none of the others have.
  const p1 = person("p1", { identity: "woman", seeking: "men" });
  const p2 = person("p2", { identity: "man", seeking: "women" });

  // p3, p4, p5, p6 are men seeking "other" (unmatched identity)
  const p3 = person("p3", { identity: "man", seeking: "nonbinary" });
  const p4 = person("p4", { identity: "man", seeking: "nonbinary" });
  const p5 = person("p5", { identity: "man", seeking: "nonbinary" });
  const p6 = person("p6", { identity: "man", seeking: "nonbinary" });

  const participants = [p1, p2, p3, p4, p5, p6];
  assert.equal(participants.length, 6);

  // Exactly 1 compatible pair exists (p1-p2)
  const compatibleCount = countCompatiblePairs(participants);
  assert.equal(compatibleCount, 1);

  // Guard with MIN_PAIRS = 2 must skip independently of heads count
  const guard = checkCompatiblePairsGuard(participants, { minPairs: 2 });
  assert.equal(guard.shouldSkip, true);
  assert.equal(guard.compatiblePairCount, 1);
  assert.equal(guard.minPairs, 2);
});

test("exact threshold boundary for MIN_PAIRS", () => {
  const a = person("a", { identity: "woman", seeking: "everyone" });
  const b = person("b", { identity: "man", seeking: "everyone" });
  const c = person("c", { identity: "woman", seeking: "everyone" });
  const d = person("d", { identity: "man", seeking: "everyone" });

  // With a and b: exactly 1 compatible pair
  const guard1 = checkCompatiblePairsGuard([a, b], { minPairs: 2 });
  assert.equal(guard1.shouldSkip, true);
  assert.equal(guard1.compatiblePairCount, 1);

  // With a, b, c, d: multiple compatible pairs (> 2)
  const guard2 = checkCompatiblePairsGuard([a, b, c, d], { minPairs: 2 });
  assert.equal(guard2.shouldSkip, false);
  assert.ok(guard2.compatiblePairCount >= 2);

  // Exactly threshold = countCompatiblePairs:
  const totalPairs = countCompatiblePairs([a, b, c, d]);
  const guardExact = checkCompatiblePairsGuard([a, b, c, d], { minPairs: totalPairs });
  assert.equal(guardExact.shouldSkip, false);

  const guardOneAbove = checkCompatiblePairsGuard([a, b, c, d], { minPairs: totalPairs + 1 });
  assert.equal(guardOneAbove.shouldSkip, true);
});

test("exclusions reduce compatible pair count and trigger guard", () => {
  // A and B are compatible; C and D are compatible (2 compatible pairs)
  // But C and D have incompatible must-have diet
  const a = person("a", { identity: "woman", seeking: "men" });
  const b = person("b", { identity: "man", seeking: "women" });
  const c = person("c", {
    identity: "woman",
    seeking: "men",
    diet: "halal",
    importance: { ...baseAnswers().importance, diet: "must_have" },
  });
  const d = person("d", {
    identity: "man",
    seeking: "women",
    diet: "vegetarian",
  });

  // A-B is 1 pair; C-D is excluded due to must_have_diet
  // A-D and C-B: A seeks men (b, d), but d's diet? A has diet none, so A-D might be compatible unless age/diet
  // Let's restrict seeking to exact pairs
  const c1 = person("c1", { age_min: "21", age_max: "24", age_bracket: "age_21_24" as any });
  const c2 = person("c2", { age_min: "21", age_max: "24", age_bracket: "age_21_24" as any });
  const d1 = person("d1", {
    age_min: "35",
    age_max: "40",
    age_bracket: "age_35_39",
    diet: "halal",
    importance: { ...baseAnswers().importance, diet: "must_have" },
  });
  const d2 = person("d2", {
    age_min: "35",
    age_max: "40",
    age_bracket: "age_35_39",
    diet: "vegetarian",
  });

  // Without diet exclusion, c1-c2 (pair 1) and d1-d2 (pair 2) -> 2 pairs
  // But d1 has must_have halal and d2 has vegetarian -> d1-d2 excluded!
  const pool = [c1, c2, d1, d2];
  const count = countCompatiblePairs(pool);
  assert.equal(count, 1);

  const guard = checkCompatiblePairsGuard(pool, { minPairs: 2 });
  assert.equal(guard.shouldSkip, true);
  if (guard.shouldSkip) {
    assert.equal(guard.audit.excluded_counts["must_have_diet"], 1);
  }

  // Block exclusion:
  // Now take compatible pair c1 and c2, plus compatible pair e1 and e2
  const e1 = person("e1", { age_min: "35", age_max: "40", age_bracket: "age_35_39" });
  const e2 = person("e2", { age_min: "35", age_max: "40", age_bracket: "age_35_39" });
  const blockedPool = [c1, c2, e1, e2];
  assert.equal(countCompatiblePairs(blockedPool), 2);

  // Block e1 and e2
  const blockedKeys = new Set([canonicalPairKey("e1", "e2")]);
  const blockedCount = countCompatiblePairs(blockedPool, blockedKeys);
  assert.equal(blockedCount, 1);

  const blockedGuard = checkCompatiblePairsGuard(blockedPool, {
    blockedPairKeys: blockedKeys,
    minPairs: 2,
  });
  assert.equal(blockedGuard.shouldSkip, true);
  if (blockedGuard.shouldSkip) {
    assert.equal(blockedGuard.audit.excluded_counts["blocked_pair"], 1);
  }
});

test("audit shape conforms strictly to specification", () => {
  const p1 = person("p1", { identity: "woman", seeking: "men" });
  const p2 = person("p2", { identity: "man", seeking: "women" });
  const p3 = person("p3", { identity: "man", seeking: "nonbinary" });

  const participants = [p1, p2, p3];
  const guard = checkCompatiblePairsGuard(participants, {
    minPairs: 2,
    excluded: { not_member: 3, banned: 1 },
    now: "2026-10-10T12:00:00.000Z",
  });

  assert.equal(guard.shouldSkip, true);
  if (!guard.shouldSkip) return;

  const { audit } = guard;
  assert.equal(audit.status, "skipped_min_pairs");
  assert.equal(audit.skip_reason, "compatible_pairs_below_minimum");
  assert.equal(audit.min_pairs, 2);
  assert.equal(audit.pool_size, 3);
  assert.equal(audit.eligible_pair_count, 1);
  assert.equal(audit.algorithm_path, "skipped");
  assert.deepEqual(audit.pairs, []);
  assert.deepEqual(audit.unmatched_member_ids, ["p1", "p2", "p3"]);
  assert.equal(audit.timestamp, "2026-10-10T12:00:00.000Z");

  // Verify excluded counts combines incoming exclusions + matcher exclusions
  assert.equal(audit.excluded_counts["not_member"], 3);
  assert.equal(audit.excluded_counts["banned"], 1);
  assert.ok(audit.excluded_counts["identity_seeking"] >= 1);

  // Verify zero em dashes anywhere in audit string fields
  assert.ok(!audit.skip_reason.includes("—"));
  assert.ok(!audit.algorithm_path.includes("—"));
});
