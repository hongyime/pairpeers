import test from "node:test";
import assert from "node:assert/strict";
import { generateMatchRationale } from "./matchRationale.ts";

test("returns shared interests up to 3 with warm readable formatting", () => {
  const a = {
    interests: ["cafe", "film", "music", "reading"],
  };
  const b = {
    interests: ["gaming", "film", "cafe", "music"],
  };

  const rationale = generateMatchRationale(a, b);
  assert.equal(rationale.sharedInterests.length, 3);
  assert.deepEqual(rationale.sharedInterests, [
    "cafe-hopping",
    "film and cinema",
    "music and concerts",
  ]);
  assert.equal(
    rationale.sharedInterestsText,
    "You both love cafe-hopping, film and cinema, and music and concerts."
  );
});

test("handles 1 and 2 shared interests correctly", () => {
  const oneA = { interests: ["cafe"] };
  const oneB = { interests: ["cafe", "travel"] };
  const resOne = generateMatchRationale(oneA, oneB);
  assert.equal(resOne.sharedInterestsText, "You both love cafe-hopping.");

  const twoA = { interests: ["cafe", "travel"] };
  const twoB = { interests: ["travel", "cafe"] };
  const resTwo = generateMatchRationale(twoA, twoB);
  assert.equal(resTwo.sharedInterestsText, "You both love cafe-hopping and travel.");
});

test("handles zero shared interests with warm fallback", () => {
  const a = { interests: ["gaming"] };
  const b = { interests: ["fashion"] };
  const res = generateMatchRationale(a, b);
  assert.equal(res.sharedInterests.length, 0);
  assert.equal(
    res.sharedInterestsText,
    "You bring different personal interests to share with each other."
  );
});

test("identifies social vs alone recharge complementary trait", () => {
  const a = { recharge: "social" };
  const b = { recharge: "alone" };
  const res = generateMatchRationale(a, b);
  assert.equal(
    res.complementaryTrait,
    "One brings social spark to outings, while the other offers a calm, grounding presence."
  );
});

test("identifies talk_now vs cool_down conflict complementary trait and difference", () => {
  const a = { conflict: "talk_now", recharge: "food" };
  const b = { conflict: "cool_down", recharge: "food" };
  const res = generateMatchRationale(a, b);
  assert.equal(
    res.complementaryTrait,
    "One seeks quick clarity while the other takes time to process, balancing urgency with thoughtful perspective."
  );
  assert.equal(
    res.honestDifference,
    "In disagreements, one leans toward talking it out right away, while the other prefers time to cool down first."
  );
});

test("identifies chronotype difference when other traits match", () => {
  const a = { conflict: "talk_now", chronotype: "sunrise" };
  const b = { conflict: "talk_now", chronotype: "night_owl" };
  const res = generateMatchRationale(a, b);
  assert.equal(
    res.honestDifference,
    "Daily schedules differ: one is an early riser, while the other is a night owl."
  );
});

test("handles completely identical answers with graceful fallbacks", () => {
  const a = {
    interests: ["cafe"],
    recharge: "alone",
    conflict: "cool_down",
    chronotype: "sunrise",
    texting_pref: "checkins",
    diet: "none",
    smokes: "no",
  };
  const b = { ...a };
  const res = generateMatchRationale(a, b);
  assert.equal(
    res.honestDifference,
    "You share remarkably similar daily habits, while bringing your own distinct backgrounds to the conversation."
  );
});

test("ensures no em dashes exist anywhere in the generated copy", () => {
  const combos = [
    [{}, {}],
    [{ recharge: "social", conflict: "talk_now" }, { recharge: "alone", conflict: "cool_down" }],
    [{ chronotype: "sunrise", smokes: "no" }, { chronotype: "night_owl", smokes: "socially" }],
    [{ texting_pref: "nonstop" }, { texting_pref: "silence" }],
  ];

  for (const [a, b] of combos) {
    const res = generateMatchRationale(a, b);
    const combined = `${res.sharedInterestsText} ${res.complementaryTrait} ${res.honestDifference}`;
    assert.ok(!combined.includes("—"), `Text must not contain em dashes: ${combined}`);
  }
});
