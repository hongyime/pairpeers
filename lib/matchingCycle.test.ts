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
