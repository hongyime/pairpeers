/**
 * PairPeers match rationale generator.
 *
 * Generates a short, warm, honest rationale from two members' questionnaire answers:
 * - Shared interests (up to 3)
 * - One complementary trait
 * - One honest difference
 *
 * Rules:
 * - Pure function of two answer sets.
 * - Never shows scores.
 * - Never shows names or contact details.
 * - Symmetrical perspective ("You both...", "One of you...").
 * - Concise, warm, no em dashes, no AI-sounding phrasing.
 */

export type MatchRationale = {
  sharedInterests: string[];
  sharedInterestsText: string;
  complementaryTrait: string;
  honestDifference: string;
};

const INTEREST_LABELS: Record<string, string> = {
  gaming: "gaming",
  film: "film and cinema",
  cafe: "cafe-hopping",
  volunteering: "volunteering",
  outdoors: "hiking and outdoors",
  music: "music and concerts",
  fitness: "fitness and sports",
  photography: "photography",
  food: "food and cooking",
  reading: "reading",
  art: "art and design",
  travel: "travel",
  boardgames: "board games",
  fashion: "fashion and styling",
};

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function generateMatchRationale(
  aAnswers: Record<string, unknown> | null | undefined,
  bAnswers: Record<string, unknown> | null | undefined
): MatchRationale {
  const a = aAnswers ?? {};
  const b = bAnswers ?? {};

  // 1. Shared interests (up to 3)
  const aInterests = toStringArray(a.interests);
  const bInterests = toStringArray(b.interests);
  const bInterestSet = new Set(bInterests);

  const sharedKeys = aInterests.filter((key) => bInterestSet.has(key)).slice(0, 3);
  const sharedLabels = sharedKeys.map((k) => INTEREST_LABELS[k] ?? k);

  let sharedInterestsText: string;
  if (sharedLabels.length > 0) {
    sharedInterestsText = `You both love ${formatList(sharedLabels)}.`;
  } else {
    sharedInterestsText =
      "You bring different personal interests to share with each other.";
  }

  // 2. One complementary trait
  const aRecharge = toStringValue(a.recharge);
  const bRecharge = toStringValue(b.recharge);
  const aChrono = toStringValue(a.chronotype);
  const bChrono = toStringValue(b.chronotype);
  const aConflict = toStringValue(a.conflict);
  const bConflict = toStringValue(b.conflict);
  const aTexting = toStringValue(a.texting_pref);
  const bTexting = toStringValue(b.texting_pref);

  const aGreen = toStringArray(a.green_flags);
  const bGreen = toStringArray(b.green_flags);
  const bGreenSet = new Set(bGreen);

  let complementaryTrait = "";

  // Complementary (contrasting & balancing) pairings first:
  // Conflict resolution balance
  if (
    (aConflict === "talk_now" && bConflict === "cool_down") ||
    (aConflict === "cool_down" && bConflict === "talk_now")
  ) {
    complementaryTrait =
      "One seeks quick clarity while the other takes time to process, balancing urgency with thoughtful perspective.";
  } else if (
    (aConflict === "talk_now" && bConflict === "write") ||
    (aConflict === "write" && bConflict === "talk_now")
  ) {
    complementaryTrait =
      "One brings direct spoken honesty while the other brings thoughtful written reflection.";
  }

  // Recharge balance (extrovert / introvert balance)
  if (!complementaryTrait) {
    if (
      (aRecharge === "social" && bRecharge === "alone") ||
      (aRecharge === "alone" && bRecharge === "social")
    ) {
      complementaryTrait =
        "One brings social spark to outings, while the other offers a calm, grounding presence.";
    } else if (
      (aRecharge === "social" && bRecharge === "sleep") ||
      (aRecharge === "sleep" && bRecharge === "social")
    ) {
      complementaryTrait =
        "One brings energy for going out, while the other values restorative quiet time.";
    } else if (
      (aRecharge === "exercise" && bRecharge === "food") ||
      (aRecharge === "food" && bRecharge === "exercise")
    ) {
      complementaryTrait =
        "One brings active motivation, while the other brings a passion for good meals.";
    }
  }

  // Chronotype balance (early bird / night owl)
  if (!complementaryTrait) {
    if (
      (aChrono === "sunrise" && bChrono === "night_owl") ||
      (aChrono === "night_owl" && bChrono === "sunrise")
    ) {
      complementaryTrait =
        "One catches early mornings while the other thrives at night, balancing your hours.";
    }
  }

  // Values balance
  if (!complementaryTrait) {
    if (
      (aGreen.includes("humour") && bGreen.includes("maturity")) ||
      (bGreen.includes("humour") && aGreen.includes("maturity"))
    ) {
      complementaryTrait =
        "One brings lighthearted humour while the other brings steady emotional maturity.";
    }
  }

  // Shared grounding strengths if no contrasting complementary trait was present
  if (!complementaryTrait) {
    if (aRecharge === "social" && bRecharge === "social") {
      complementaryTrait =
        "You both feed off social energy and exploring lively places together.";
    } else if (aRecharge === "alone" && bRecharge === "alone") {
      complementaryTrait =
        "You both appreciate peaceful downtime and low-pressure company.";
    } else if (aRecharge === "food" && bRecharge === "food") {
      complementaryTrait =
        "You both appreciate delicious meals and discovering new spots to eat.";
    } else if (aConflict === "talk_now" && bConflict === "talk_now") {
      complementaryTrait =
        "You both prefer addressing things directly and promptly.";
    } else if (aConflict === "cool_down" && bConflict === "cool_down") {
      complementaryTrait =
        "You both prefer letting emotions settle before having thoughtful conversations.";
    } else if (aChrono === "sunrise" && bChrono === "sunrise") {
      complementaryTrait = "You both make the most of quiet mornings.";
    } else if (aChrono === "night_owl" && bChrono === "night_owl") {
      complementaryTrait =
        "You both enjoy late-night energy and easy conversation after hours.";
    } else if (aGreen.some((g) => bGreenSet.has(g) && g === "kindness")) {
      complementaryTrait =
        "A shared foundation of everyday kindness and warmth.";
    } else if (aGreen.some((g) => bGreenSet.has(g) && g === "communication")) {
      complementaryTrait =
        "A shared commitment to open, honest communication.";
    } else if (aTexting === "checkins" && bTexting === "checkins") {
      complementaryTrait =
        "You both appreciate steady check-ins without feeling overwhelmed.";
    } else {
      complementaryTrait =
        "A natural balance between shared perspectives and individual habits.";
    }
  }

  // 3. One honest difference
  let honestDifference = "";

  // Conflict difference
  if (aConflict && bConflict && aConflict !== bConflict) {
    if (
      (aConflict === "talk_now" && bConflict === "cool_down") ||
      (aConflict === "cool_down" && bConflict === "talk_now")
    ) {
      honestDifference =
        "In disagreements, one leans toward talking it out right away, while the other prefers time to cool down first.";
    } else if (
      (aConflict === "talk_now" && bConflict === "write") ||
      (aConflict === "write" && bConflict === "talk_now")
    ) {
      honestDifference =
        "When resolving tension, one talks right away, while the other likes writing thoughts down first.";
    } else if (
      (aConflict === "talk_now" && bConflict === "avoid") ||
      (aConflict === "avoid" && bConflict === "talk_now")
    ) {
      honestDifference =
        "One tackles disagreements immediately, while the other needs a gentle, patient space to open up.";
    } else {
      honestDifference =
        "Different conflict styles: you each take distinct approaches to working through difficult conversations.";
    }
  }

  // Chronotype difference
  if (!honestDifference && aChrono && bChrono && aChrono !== bChrono) {
    if (
      (aChrono === "sunrise" && bChrono === "night_owl") ||
      (aChrono === "night_owl" && bChrono === "sunrise")
    ) {
      honestDifference =
        "Daily schedules differ: one is an early riser, while the other is a night owl.";
    } else if (
      (aChrono === "sunrise" && bChrono === "in_between") ||
      (aChrono === "in_between" && bChrono === "sunrise")
    ) {
      honestDifference =
        "Morning rhythms differ: one is up early, while the other eases into the day.";
    } else {
      honestDifference =
        "Evening routines differ: one turns in earlier, while the other stays up later.";
    }
  }

  // Recharge difference
  if (!honestDifference && aRecharge && bRecharge && aRecharge !== bRecharge) {
    if (
      (aRecharge === "alone" && bRecharge === "social") ||
      (aRecharge === "social" && bRecharge === "alone")
    ) {
      honestDifference =
        "Weekend recharging looks different: one seeks quiet alone time, while the other recharges by going out.";
    } else if (
      (aRecharge === "exercise" && bRecharge === "sleep") ||
      (aRecharge === "sleep" && bRecharge === "exercise")
    ) {
      honestDifference =
        "Reset habits differ: one works out to recharge, while the other needs restorative sleep.";
    } else {
      honestDifference =
        "Recharge habits differ: you each restore energy in your own distinct way.";
    }
  }

  // Texting difference
  if (!honestDifference && aTexting && bTexting && aTexting !== bTexting) {
    if (
      (aTexting === "nonstop" && bTexting === "silence") ||
      (aTexting === "silence" && bTexting === "nonstop")
    ) {
      honestDifference =
        "Texting styles differ: one likes lively frequent messaging, while the other prefers comfortable quiet.";
    } else if (
      (aTexting === "checkins" && bTexting === "silence") ||
      (aTexting === "silence" && bTexting === "checkins")
    ) {
      honestDifference =
        "Communication pacing differs: one values regular check-ins, while the other is comfortable with space between chats.";
    } else {
      honestDifference =
        "Texting rhythms differ: one prefers constant chat, while the other likes steady check-ins.";
    }
  }

  // Diet difference
  const aDiet = toStringValue(a.diet);
  const bDiet = toStringValue(b.diet);
  if (!honestDifference && aDiet && bDiet && aDiet !== bDiet && (aDiet !== "none" || bDiet !== "none")) {
    honestDifference =
      "Food choices differ: different dietary preferences when choosing spots for dinner.";
  }

  // Smoking difference
  const aSmokes = toStringValue(a.smokes);
  const bSmokes = toStringValue(b.smokes);
  if (!honestDifference && aSmokes && bSmokes && aSmokes !== bSmokes) {
    honestDifference =
      "Personal habits differ: one is a non-smoker, while the other smokes socially.";
  }

  // Interests difference
  if (!honestDifference) {
    const aOnly = aInterests.find((item) => !bInterestSet.has(item));
    const bOnly = bInterests.find((item) => !new Set(aInterests).has(item));
    if (aOnly && bOnly) {
      const aLabel = INTEREST_LABELS[aOnly] ?? aOnly;
      const bLabel = INTEREST_LABELS[bOnly] ?? bOnly;
      honestDifference = `Personal hobbies differ: one spends time on ${aLabel}, while the other focuses on ${bLabel}.`;
    }
  }

  // Fallback
  if (!honestDifference) {
    honestDifference =
      "You share remarkably similar daily habits, while bringing your own distinct backgrounds to the conversation.";
  }

  return {
    sharedInterests: sharedLabels,
    sharedInterestsText,
    complementaryTrait,
    honestDifference,
  };
}
