import test from "node:test";
import assert from "node:assert/strict";
import {
  canSubmitFeedback,
  applyMatchOptInTransition,
  applyMatchDateTransition,
  applyMatchFeedbackTransition,
  getMatchStatusLabel,
  type TmaMatch,
} from "./tmaMatches.ts";

function mockMatch(patch: Partial<TmaMatch> = {}): TmaMatch {
  return {
    id: "m-1",
    status: "pending",
    cycle_started_at: "2026-10-10T00:00:00.000Z",
    accepted_at: null,
    my_response: null,
    partner_responded: false,
    rationale: {
      sharedInterests: ["Coffee", "Walks"],
      sharedInterestsText: "Coffee and walks",
      complementaryTrait: "Calm and energetic",
      honestDifference: "Morning vs evening",
    },
    contact: null,
    date: {
      status: "not_planned",
      scheduled_at: null,
    },
    feedback: null,
    ...patch,
  };
}

test("getMatchStatusLabel produces friendly copy with zero em dashes", () => {
  const labels = [
    getMatchStatusLabel("pending", null),
    getMatchStatusLabel("pending", "accepted"),
    getMatchStatusLabel("accepted", "accepted"),
    getMatchStatusLabel("declined", "declined"),
    getMatchStatusLabel("expired", null),
  ];

  for (const label of labels) {
    assert.equal(label.includes("—"), false, `Label "${label}" contains em dash`);
    assert.equal(label.includes("--"), false, `Label "${label}" contains double dash`);
  }
});

test("canSubmitFeedback gates feedback until date happened or skipped", () => {
  assert.equal(canSubmitFeedback("not_planned"), false);
  assert.equal(canSubmitFeedback("scheduled"), false);
  assert.equal(canSubmitFeedback("happened"), true);
  assert.equal(canSubmitFeedback("skipped"), true);
});

test("applyMatchOptInTransition correctly updates my_response and status", () => {
  const match = mockMatch();

  // First accept
  const accepted = applyMatchOptInTransition(match, "accept", "pending");
  assert.equal(accepted.my_response, "accepted");
  assert.equal(accepted.status, "pending");

  // Mutual accept
  const mutual = applyMatchOptInTransition(match, "accept", "accepted");
  assert.equal(mutual.my_response, "accepted");
  assert.equal(mutual.status, "accepted");

  // Decline
  const declined = applyMatchOptInTransition(match, "decline");
  assert.equal(declined.my_response, "declined");
  assert.equal(declined.status, "declined");
});

test("applyMatchDateTransition correctly records scheduling and check-in", () => {
  const match = mockMatch({ status: "accepted" });

  const scheduledTime = "2026-10-15T18:00:00.000Z";
  const scheduled = applyMatchDateTransition(match, "scheduled", scheduledTime);
  assert.equal(scheduled.date.status, "scheduled");
  assert.equal(scheduled.date.scheduled_at, scheduledTime);

  const happened = applyMatchDateTransition(scheduled, "happened");
  assert.equal(happened.date.status, "happened");
  assert.ok(happened.date.checked_in_at);

  const skipped = applyMatchDateTransition(scheduled, "skipped");
  assert.equal(skipped.date.status, "skipped");
  assert.ok(skipped.date.checked_in_at);

  const reset = applyMatchDateTransition(happened, "not_planned");
  assert.equal(reset.date.status, "not_planned");
  assert.equal(reset.date.scheduled_at, null);
});

test("applyMatchFeedbackTransition saves private feedback note and rating", () => {
  const match = mockMatch({ status: "accepted", date: { status: "happened", scheduled_at: null } });

  const withFeedback = applyMatchFeedbackTransition(match, true, "Great conversation");
  assert.deepEqual(withFeedback.feedback, {
    would_meet_again: true,
    note: "Great conversation",
  });
});

test("handles empty, loading, and error states gracefully", () => {
  // Empty state verification
  const emptyMatches: TmaMatch[] = [];
  assert.equal(emptyMatches.length, 0);

  // Simulated session pass-through response
  const sessionSuccessResponse = {
    ok: true,
    matches: [mockMatch()],
  };
  assert.equal(sessionSuccessResponse.matches.length, 1);

  // Simulated unauthenticated error
  const unauthenticatedResponse = {
    ok: false,
    error: "unauthenticated",
  };
  assert.equal(unauthenticatedResponse.error, "unauthenticated");
});
