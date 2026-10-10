import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDateTransition,
  isFeedbackEligible,
  getSweepNudgeText,
  type MatchDateRecord,
} from "./matchDates.ts";

test("isFeedbackEligible enforces accepted match AND happened or skipped date", () => {
  // Pending match cannot submit feedback
  assert.equal(isFeedbackEligible("pending", "happened"), false);
  assert.equal(isFeedbackEligible("declined", "happened"), false);

  // Accepted match without date or not_planned cannot submit feedback
  assert.equal(isFeedbackEligible("accepted", null), false);
  assert.equal(isFeedbackEligible("accepted", "not_planned"), false);
  assert.equal(isFeedbackEligible("accepted", "scheduled"), false);

  // Accepted match with happened or skipped CAN submit feedback
  assert.equal(isFeedbackEligible("accepted", "happened"), true);
  assert.equal(isFeedbackEligible("accepted", "skipped"), true);
});

test("computeDateTransition handles scheduling and generates partner notification", () => {
  const current: MatchDateRecord = {
    match_id: "m1",
    status: "not_planned",
    scheduled_at: null,
    checked_in_at: null,
  };

  const res = computeDateTransition(current, {
    type: "schedule",
    scheduledAt: "2026-10-15T19:00:00Z",
  });

  assert.equal(res.nextStatus, "scheduled");
  assert.equal(res.scheduledAt, "2026-10-15T19:00:00Z");
  assert.ok(res.notifyPartnerText);
  assert.ok(!res.notifyPartnerText.includes("—"));
});

test("computeDateTransition handles happened and skipped check-ins", () => {
  const current: MatchDateRecord = {
    match_id: "m1",
    status: "scheduled",
    scheduled_at: "2026-10-15T19:00:00Z",
    checked_in_at: null,
  };

  const happenedRes = computeDateTransition(current, {
    type: "check_in",
    status: "happened",
  });
  assert.equal(happenedRes.nextStatus, "happened");
  assert.ok(happenedRes.checkedInAt);

  const skippedRes = computeDateTransition(current, {
    type: "check_in",
    status: "skipped",
  });
  assert.equal(skippedRes.nextStatus, "skipped");
  assert.ok(skippedRes.checkedInAt);
});

test("getSweepNudgeText asks for date status when date has not happened or skipped", () => {
  const baseUrl = "https://pairpeers.hong-yi.me";

  const nudge7d = getSweepNudgeText("day_7", "not_planned", baseUrl);
  assert.ok(nudge7d.includes("chance to meet yet"));
  assert.ok(!nudge7d.includes("—"));

  const nudge14d = getSweepNudgeText("day_14", "scheduled", baseUrl);
  assert.ok(nudge14d.includes("Checking in on your introduction"));
  assert.ok(!nudge14d.includes("—"));
});

test("getSweepNudgeText asks for feedback when date happened or was skipped", () => {
  const baseUrl = "https://pairpeers.hong-yi.me";

  const nudge7d = getSweepNudgeText("day_7", "happened", baseUrl);
  assert.ok(nudge7d.includes("Share private feedback"));

  const nudge14d = getSweepNudgeText("day_14", "skipped", baseUrl);
  assert.ok(nudge14d.includes("Would you meet your introduction again?"));
});
