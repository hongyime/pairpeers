import test from "node:test";
import assert from "node:assert/strict";

test("adult confirmation: missing or false is rejected", () => {
  function checkAdultConfirmation(body: any): { ok: boolean; error?: string } {
    const adultConfirmed =
      body && typeof body === "object" ? body.adult_confirmed : undefined;
    if (adultConfirmed !== true) {
      return { ok: false, error: "adult_confirmation_required" };
    }
    return { ok: true };
  }

  assert.deepEqual(checkAdultConfirmation({}), {
    ok: false,
    error: "adult_confirmation_required",
  });
  assert.deepEqual(checkAdultConfirmation({ adult_confirmed: false }), {
    ok: false,
    error: "adult_confirmation_required",
  });
  assert.deepEqual(checkAdultConfirmation({ adult_confirmed: "true" }), {
    ok: false,
    error: "adult_confirmation_required",
  });
  assert.deepEqual(checkAdultConfirmation({ adult_confirmed: null }), {
    ok: false,
    error: "adult_confirmation_required",
  });
  assert.deepEqual(checkAdultConfirmation({ adult_confirmed: true }), {
    ok: true,
  });
});

test("timestamps set server-side and repeat submission preserves initial adult_confirmed_at", () => {
  function computeProfileUpdates(
    existingProfile: { adult_confirmed_at: string | null; terms_accepted_at: string | null },
    now: string
  ) {
    const profileUpdates: Record<string, string> = {
      terms_accepted_at: now,
    };
    if (!existingProfile.adult_confirmed_at) {
      profileUpdates.adult_confirmed_at = now;
    }
    return profileUpdates;
  }

  const t1 = "2026-10-10T10:00:00.000Z";
  const initial = { adult_confirmed_at: null, terms_accepted_at: null };
  const firstUpdates = computeProfileUpdates(initial, t1);

  assert.equal(firstUpdates.adult_confirmed_at, t1);
  assert.equal(firstUpdates.terms_accepted_at, t1);

  // Repeat submission at t2
  const t2 = "2026-10-10T12:00:00.000Z";
  const repeatProfile = { adult_confirmed_at: t1, terms_accepted_at: t1 };
  const repeatUpdates = computeProfileUpdates(repeatProfile, t2);

  assert.equal(repeatUpdates.terms_accepted_at, t2);
  // adult_confirmed_at is preserved and not overwritten on repeat
  assert.equal(repeatUpdates.adult_confirmed_at, undefined);
});

test("questionnaire form submission gating on adult confirmation", () => {
  function canSubmitQuestionnaire(answeredCount: number, requiredCount: number, adultConfirmed: boolean) {
    return answeredCount >= requiredCount && adultConfirmed === true;
  }

  assert.equal(canSubmitQuestionnaire(10, 10, false), false);
  assert.equal(canSubmitQuestionnaire(9, 10, true), false);
  assert.equal(canSubmitQuestionnaire(10, 10, true), true);
});
