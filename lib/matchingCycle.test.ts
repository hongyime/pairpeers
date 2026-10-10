import test from "node:test";
import assert from "node:assert/strict";
import { greedyMaxWeightMatching, irving, runCycle, type CycleAnswers, type CycleParticipant, type ScoredPair } from "./matchingCycle.ts";

const answers = (overrides: Partial<CycleAnswers> = {}): CycleAnswers => ({
  identity: "man",
  interests: ["music", "film"],
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

const person = (id: string, patch: Partial<CycleAnswers> = {}): CycleParticipant => ({ id, answers: answers(patch) });

test("must-have smoking preference excludes an otherwise eligible pair", () => {
  const a = person("a", { smoking_pref: "hard_no", importance: { ...answers().importance, smoking_pref: "must_have" } });
  const b = person("b", { smokes: "yes" });
  const result = runCycle([a, b]);
  assert.equal(result.pairs.length, 0);
  assert.deepEqual(result.unmatched, ["a", "b"]);
});

test("age bracket outside the seeker's range excludes the pair", () => {
  const a = person("a", { age_min: "21", age_max: "25" });
  const b = person("b", { age_bracket: "age_35_39" });
  const result = runCycle([a, b]);
  assert.equal(result.pairs.length, 0);
  assert.deepEqual(result.unmatched, ["a", "b"]);
});

test("overlapping age bracket keeps the pair eligible", () => {
  const a = person("a", { age_min: "21", age_max: "40" });
  const b = person("b", { age_bracket: "age_35_39" });
  const result = runCycle([a, b]);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.ageFilterSkippedMemberIds.length, 0);
});

test("Irving returns reciprocal pairs for a stable roommate pool", () => {
  const result = irving({
    a: ["b", "c", "d"],
    b: ["a", "d", "c"],
    c: ["d", "a", "b"],
    d: ["c", "b", "a"],
  });
  assert.deepEqual(result, { a: "b", b: "a", c: "d", d: "c" });
});

test("no-stable profile exercises the greedy max-weight fallback", () => {
  const preferences = {
    a: ["c", "b", "d"],
    b: ["d", "a", "c"],
    c: ["d", "b", "a"],
    d: ["a", "b", "c"],
  };
  assert.equal(irving(preferences), null);
  const pairs: ScoredPair[] = [
    { aId: "a", bId: "b", aScore: 80, bScore: 80, mutualScore: 80, ageFilterSkipped: false },
    { aId: "a", bId: "c", aScore: 70, bScore: 70, mutualScore: 70, ageFilterSkipped: false },
    { aId: "c", bId: "d", aScore: 60, bScore: 60, mutualScore: 60, ageFilterSkipped: false },
  ];
  assert.deepEqual(greedyMaxWeightMatching(pairs).map((pair) => pair.aId + pair.bId), ["ab", "cd"]);
});

test("reciprocal non-binary eligibility allows open-pool pairing", () => {
  const nb = person("nb", { identity: "nonbinary", seeking: "everyone" });
  const pns = person("pns", { identity: "prefer_not", seeking: "everyone" });
  const woman = person("w", { identity: "woman", seeking: "everyone" });

  const result = runCycle([nb, pns, woman]);
  // With 3 people all seeking everyone, irving or greedy fallback pairs two and leaves one
  assert.equal(result.pairs.length, 1);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.eligiblePairCount, 3);
});

test("no accidental exclusions and no binary gender coercion", () => {
  const nb = person("nb", { identity: "nonbinary", seeking: "everyone" });
  const binarySeeker = person("bs", { identity: "man", seeking: "women" });
  const manSeekingEveryone = person("m_open", { identity: "man", seeking: "everyone" });

  // nb vs binarySeeker (seeking women): binarySeeker excludes nonbinary, so not eligible
  const result1 = runCycle([nb, binarySeeker]);
  assert.equal(result1.pairs.length, 0);
  assert.deepEqual(result1.unmatched, ["bs", "nb"]);
  assert.equal(result1.excludedPairCounts["identity_seeking"], 1);

  // nb vs manSeekingEveryone: both reciprocally satisfy seeking: "everyone"
  const result2 = runCycle([nb, manSeekingEveryone]);
  assert.equal(result2.pairs.length, 1);
  assert.deepEqual(result2.unmatched, []);
});

test("greedy fallback handles odd pool with non-binary member when irving has no stable solution", () => {
  // Construct 4 participants with a preference cycle so Irving fails, including nonbinary participant
  const nb = person("nb", { identity: "nonbinary", seeking: "everyone", interests: ["gaming", "art"] });
  const p1 = person("p1", { identity: "woman", seeking: "everyone", interests: ["gaming"] });
  const p2 = person("p2", { identity: "man", seeking: "everyone", interests: ["art"] });
  const p3 = person("p3", { identity: "man", seeking: "everyone", interests: ["film"] });

  const result = runCycle([nb, p1, p2, p3]);
  assert.equal(result.pairs.length, 2);
  assert.equal(result.unmatched.length, 0);
  assert.ok(["stable-roommates", "greedy-fallback"].includes(result.algorithm));
});

test("diet hard filter: exact matches pass", () => {
  const a = person("a", { diet: "halal", importance: { ...answers().importance, diet: "must_have" } });
  const b = person("b", { diet: "halal" });
  const result = runCycle([a, b]);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.unmatched.length, 0);
});

test("diet hard filter: none acts as wildcard", () => {
  const a = person("a", { diet: "vegetarian", importance: { ...answers().importance, diet: "must_have" } });
  const b = person("b", { diet: "none" });
  const result = runCycle([a, b]);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.unmatched.length, 0);

  // Vice versa: seeker with none, candidate with halal
  const c = person("c", { diet: "none", importance: { ...answers().importance, diet: "must_have" } });
  const d = person("d", { diet: "halal" });
  const result2 = runCycle([c, d]);
  assert.equal(result2.pairs.length, 1);
});

test("diet hard filter: incompatible must-have is excluded", () => {
  const a = person("a", { diet: "halal", importance: { ...answers().importance, diet: "must_have" } });
  const b = person("b", { diet: "vegetarian" });
  const result = runCycle([a, b]);
  assert.equal(result.pairs.length, 0);
  assert.deepEqual(result.unmatched, ["a", "b"]);
  assert.equal(result.excludedPairCounts["must_have_diet"], 1);
});

test("diet hard filter: reciprocal exclusion when either participant sets must-have", () => {
  // Candidate b sets must-have, seeker a does not
  const a = person("a", { diet: "no_beef", importance: { ...answers().importance, diet: "important" } });
  const b = person("b", { diet: "no_pork", importance: { ...answers().importance, diet: "must_have" } });
  const result = runCycle([a, b]);
  assert.equal(result.pairs.length, 0);
  assert.deepEqual(result.unmatched, ["a", "b"]);
  assert.equal(result.excludedPairCounts["must_have_diet"], 1);
});

test("religion preference: exact match, wildcard, and incompatible must-have", () => {
  // Exact match
  const a = person("a", { religion: "christian", religion_pref: "christian", importance: { ...answers().importance, religion_pref: "must_have" } });
  const b = person("b", { religion: "christian" });
  const res1 = runCycle([a, b]);
  assert.equal(res1.pairs.length, 1);

  // prefer_not_to_say wildcard
  const c = person("c", { religion: "muslim", religion_pref: "muslim", importance: { ...answers().importance, religion_pref: "must_have" } });
  const d = person("d", { religion: "prefer_not_to_say" });
  const res2 = runCycle([c, d]);
  assert.equal(res2.pairs.length, 1);

  // Incompatible
  const e = person("e", { religion_pref: "buddhist", importance: { ...answers().importance, religion_pref: "must_have" } });
  const f = person("f", { religion: "hindu" });
  const res3 = runCycle([e, f]);
  assert.equal(res3.pairs.length, 0);
  assert.equal(res3.excludedPairCounts["must_have_religion"], 1);
});


