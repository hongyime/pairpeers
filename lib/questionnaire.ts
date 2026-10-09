/**
 * PairPeers questionnaire — shared definitions for the two-track form.
 *
 * Track A ("about"): who you are — builds the profile others see.
 * Track B ("want"): what you want — builds the preference ranking that
 * feeds the Gale-Shapley matcher. Every Track B answer carries a private
 * importance weight (must_have behaves as a hard filter).
 *
 * Imported by both the client page and the API route so the server can
 * validate submissions against the same definitions.
 */

export type Importance = "must_have" | "important" | "nice_to_have";

export const IMPORTANCE_OPTIONS: ReadonlyArray<{
  value: Importance;
  label: string;
}> = [
  { value: "must_have", label: "Must-have" },
  { value: "important", label: "Important" },
  { value: "nice_to_have", label: "Nice to have" },
];

export type OptionDef = { value: string; label: string };

export type QuestionDef = {
  key: string;
  track: "about" | "want";
  label: string;
  kind: "single" | "multi" | "text";
  options?: OptionDef[];
  /** For multi: max (and min) selectable. */
  max?: number;
  min?: number;
  required: boolean;
  hint?: string;
};

const single = (
  key: string,
  track: "about" | "want",
  label: string,
  options: Array<[string, string]>,
  required = true
): QuestionDef => ({
  key,
  track,
  label,
  kind: "single",
  options: options.map(([value, label]) => ({ value, label })),
  required,
});

const multi = (
  key: string,
  track: "about" | "want",
  label: string,
  options: Array<[string, string]>,
  max: number,
  min = 1,
  hint?: string
): QuestionDef => ({
  key,
  track,
  label,
  kind: "multi",
  options: options.map(([value, label]) => ({ value, label })),
  max,
  min,
  required: true,
  hint,
});

export const QUESTIONS: QuestionDef[] = [
  // ---- Track A: About you ----
  single("identity", "about", "I am…", [
    ["man", "Man"],
    ["woman", "Woman"],
    ["nonbinary", "Non-binary"],
    ["prefer_not", "Prefer not to say"],
  ]),
  multi(
    "interests",
    "about",
    "What are you into these days?",
    [
      ["gaming", "Gaming"],
      ["film", "Film and cinema"],
      ["cafe", "Cafe-hopping"],
      ["volunteering", "Volunteering"],
      ["outdoors", "Hiking and outdoors"],
      ["music", "Music and concerts"],
      ["fitness", "Fitness and sports"],
      ["photography", "Photography"],
      ["food", "Food and cooking"],
      ["reading", "Reading"],
      ["art", "Art and design"],
      ["travel", "Travel"],
      ["boardgames", "Board games"],
      ["fashion", "Fashion and styling"],
    ],
    5,
    1,
    "Pick up to 5"
  ),
  single("chronotype", "about", "Team sunrise or team 2am?", [
    ["sunrise", "Sunrise"],
    ["in_between", "In between"],
    ["night_owl", "2am"],
  ]),
  single("recharge", "about", "After a long week, you recharge by…", [
    ["alone", "Alone time"],
    ["social", "Going out"],
    ["exercise", "Exercise"],
    ["food", "Good food"],
    ["sleep", "Sleep"],
  ]),
  single("conflict", "about", "Mid-disagreement, you…", [
    ["talk_now", "Talk it out now"],
    ["cool_down", "Cool down then talk"],
    ["write", "Write it out first"],
    ["avoid", "Avoid it"],
  ]),
  single("diet", "about", "Any food rules?", [
    ["none", "None"],
    ["halal", "Halal"],
    ["vegetarian", "Vegetarian"],
    ["no_pork", "No pork"],
    ["no_beef", "No beef"],
  ]),
  single("smokes", "about", "Do you smoke?", [
    ["no", "No"],
    ["socially", "Socially"],
    ["yes", "Yes"],
  ]),
  single("kids", "about", "Kids in your future?", [
    ["yes", "Yes"],
    ["open", "Open to it"],
    ["unsure", "Unsure"],
    ["probably_not", "Probably not"],
    ["no", "No"],
  ]),
  {
    key: "note",
    track: "about",
    label: "A short note for your future match",
    kind: "text",
    required: false,
    hint: "Optional",
  },

  // ---- Track B: What you want ----
  single("seeking", "want", "I’m looking to meet…", [
    ["men", "Men"],
    ["women", "Women"],
    ["everyone", "Everyone"],
  ]),
  single("age_min", "want", "Youngest you’d date", [
    ["21", "21"],
    ["25", "25"],
    ["30", "30"],
    ["35", "35"],
  ]),
  single("age_max", "want", "Oldest you’d date", [
    ["25", "25"],
    ["30", "30"],
    ["35", "35"],
    ["40", "40+"],
  ]),
  multi(
    "green_flags",
    "want",
    "Green flags that matter most to you",
    [
      ["kindness", "Kindness"],
      ["honesty", "Honesty"],
      ["humour", "Humour"],
      ["ambition", "Ambition"],
      ["maturity", "Emotional maturity"],
      ["communication", "Good communication"],
      ["values", "Shared values"],
      ["adventure", "Adventurous spirit"],
    ],
    3,
    1,
    "Pick 3"
  ),
  single("smoking_pref", "want", "Smoking is…", [
    ["hard_no", "A hard no"],
    ["socially_ok", "Socially is fine"],
    ["dont_mind", "Don’t mind"],
  ]),
  single("kids_pref", "want", "On kids, a partner must be…", [
    ["aligned", "Aligned with me"],
    ["doesnt_matter", "Doesn’t matter"],
  ]),
  single("energy_pref", "want", "Their social energy should be…", [
    ["same", "Same as mine"],
    ["opposites", "Opposites attract"],
    ["doesnt_matter", "Doesn’t matter"],
  ]),
  single("texting_pref", "want", "Texting style you prefer", [
    ["nonstop", "Non-stop"],
    ["checkins", "Regular check-ins"],
    ["silence", "Comfortable silence"],
  ]),
];

export const QUESTION_MAP: Record<string, QuestionDef> = Object.fromEntries(
  QUESTIONS.map((q) => [q.key, q])
);

/** Track B question keys that take an importance weight. age_min/age_max share one. */
export const IMPORTANCE_KEYS = [
  "seeking",
  "age_range",
  "green_flags",
  "smoking_pref",
  "kids_pref",
  "energy_pref",
  "texting_pref",
] as const;

const IMPORTANCE_SET = new Set<string>(["must_have", "important", "nice_to_have"]);
const NOTE_MAX = 500;

export type ValidatedAnswers = Record<string, unknown>;

/**
 * Validates a submitted answers object against the question definitions.
 * Returns the sanitized answers (unknown keys dropped) or an error string.
 */
export function validateAnswers(input: unknown): { ok: true; answers: ValidatedAnswers } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "answers must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const answers: ValidatedAnswers = {};

  for (const q of QUESTIONS) {
    const v = raw[q.key];
    if (v === undefined || v === null || v === "") {
      if (q.required) return { ok: false, error: `missing answer: ${q.key}` };
      continue;
    }
    if (q.kind === "text") {
      if (typeof v !== "string") return { ok: false, error: `invalid answer: ${q.key}` };
      const t = v.trim();
      if (t.length > NOTE_MAX) return { ok: false, error: `answer too long: ${q.key}` };
      if (t) answers[q.key] = t;
      continue;
    }
    const allowed = new Set((q.options ?? []).map((o) => o.value));
    if (q.kind === "single") {
      if (typeof v !== "string" || !allowed.has(v)) {
        return { ok: false, error: `invalid answer: ${q.key}` };
      }
      answers[q.key] = v;
      continue;
    }
    // multi
    if (!Array.isArray(v)) return { ok: false, error: `invalid answer: ${q.key}` };
    const min = q.min ?? 1;
    const max = q.max ?? allowed.size;
    if (v.length < min || v.length > max) {
      return { ok: false, error: `invalid answer: ${q.key}` };
    }
    const seen = new Set<string>();
    for (const item of v) {
      if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) {
        return { ok: false, error: `invalid answer: ${q.key}` };
      }
      seen.add(item);
    }
    answers[q.key] = [...seen];
  }

  const ageMin = Number(answers["age_min"]);
  const ageMax = Number(answers["age_max"]);
  if (Number.isFinite(ageMin) && Number.isFinite(ageMax) && ageMin > ageMax) {
    return { ok: false, error: "age_min must not exceed age_max" };
  }

  // Importance weights (optional on input; defaulted client-side).
  const rawImp = raw["importance"];
  const importance: Record<string, Importance> = {};
  if (rawImp !== undefined) {
    if (!rawImp || typeof rawImp !== "object" || Array.isArray(rawImp)) {
      return { ok: false, error: "invalid importance" };
    }
    for (const [k, val] of Object.entries(rawImp as Record<string, unknown>)) {
      if (!(IMPORTANCE_KEYS as readonly string[]).includes(k)) {
        return { ok: false, error: `invalid importance key: ${k}` };
      }
      if (typeof val !== "string" || !IMPORTANCE_SET.has(val)) {
        return { ok: false, error: `invalid importance value: ${k}` };
      }
      importance[k] = val as Importance;
    }
  }
  for (const k of IMPORTANCE_KEYS) {
    if (!importance[k]) importance[k] = "important";
  }
  answers["importance"] = importance;

  return { ok: true, answers };
}
