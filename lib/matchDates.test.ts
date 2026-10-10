import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDateTransition,
  isFeedbackEligible,
  getSweepNudgeText,
  validateProposal,
  validateSelection,
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

// --- Date planning proposal & selection tests ---

test("validateProposal enforces slot limits (1 to 3 slots)", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const future1 = "2026-10-12T14:00:00Z";
  const future2 = "2026-10-13T14:00:00Z";
  const future3 = "2026-10-14T14:00:00Z";
  const future4 = "2026-10-15T14:00:00Z";

  // 0 slots rejected
  const emptyRes = validateProposal([], "Cafe", now);
  assert.equal(emptyRes.ok, false);

  // > 3 slots rejected
  const tooManyRes = validateProposal([future1, future2, future3, future4], "Cafe", now);
  assert.equal(tooManyRes.ok, false);

  // 1 to 3 slots accepted
  const valid1 = validateProposal([future1], "Cafe", now);
  assert.equal(valid1.ok, true);
  if (valid1.ok) {
    assert.equal(valid1.slots.length, 1);
    assert.equal(valid1.venueText, "Cafe");
  }

  const valid3 = validateProposal([future1, future2, future3], "Library", now);
  assert.equal(valid3.ok, true);
  if (valid3.ok) {
    assert.equal(valid3.slots.length, 3);
  }
});

test("validateProposal rejects past slots", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const pastSlot = "2026-10-09T10:00:00Z";
  const futureSlot = "2026-10-12T10:00:00Z";

  const res = validateProposal([pastSlot, futureSlot], "Cafe", now);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.ok(res.error.includes("past"));
    assert.ok(!res.error.includes("—"));
  }
});

test("validateProposal enforces venue length limit (200 chars)", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const futureSlot = "2026-10-12T10:00:00Z";

  const longVenue = "A".repeat(201);
  const res = validateProposal([futureSlot], longVenue, now);
  assert.equal(res.ok, false);

  const okVenue = "A".repeat(200);
  const okRes = validateProposal([futureSlot], okVenue, now);
  assert.equal(okRes.ok, true);
});

test("validateSelection role enforcement: proposer cannot select their own proposal", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const slot1 = "2026-10-12T14:00:00.000Z";
  const slot2 = "2026-10-13T14:00:00.000Z";

  const record: MatchDateRecord = {
    match_id: "m1",
    status: "not_planned",
    scheduled_at: null,
    checked_in_at: null,
    proposer_id: "user-proposer",
    slot_1: slot1,
    slot_2: slot2,
    venue_text: "Park",
  };

  // Proposer tries to select -> rejected with 403
  const proposerAttempt = validateSelection(record, "user-proposer", slot1, now);
  assert.equal(proposerAttempt.ok, false);
  if (!proposerAttempt.ok) {
    assert.equal(proposerAttempt.status, 403);
    assert.ok(!proposerAttempt.error.includes("—"));
  }

  // Partner selects -> allowed
  const partnerAttempt = validateSelection(record, "user-partner", slot1, now);
  assert.equal(partnerAttempt.ok, true);
  if (partnerAttempt.ok) {
    assert.equal(partnerAttempt.selectedSlot, slot1);
  }
});

test("validateSelection rejects slots not in proposal and past slots", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const slot1 = "2026-10-12T14:00:00Z";

  const record: MatchDateRecord = {
    match_id: "m1",
    status: "not_planned",
    scheduled_at: null,
    checked_in_at: null,
    proposer_id: "user-proposer",
    slot_1: slot1,
  };

  // Not in proposal
  const unproposed = validateSelection(record, "user-partner", "2026-10-15T10:00:00Z", now);
  assert.equal(unproposed.ok, false);

  // Past slot
  const recordWithPastSlot: MatchDateRecord = {
    ...record,
    slot_1: "2026-10-08T10:00:00Z",
  };
  const pastRes = validateSelection(
    recordWithPastSlot,
    "user-partner",
    "2026-10-08T10:00:00Z",
    now
  );
  assert.equal(pastRes.ok, false);
});

test("computeDateTransition handles proposal and partner selection lifecycle", () => {
  const nowIso = "2026-10-10T12:00:00.000Z";
  const slotA = "2026-10-14T18:00:00.000Z";
  const slotB = "2026-10-15T18:00:00.000Z";

  const initial: MatchDateRecord = {
    match_id: "m1",
    status: "not_planned",
    scheduled_at: null,
    checked_in_at: null,
  };

  // 1. Propose
  const proposed = computeDateTransition(
    initial,
    {
      type: "propose",
      proposerId: "u_alice",
      slots: [slotA, slotB],
      venueText: "Coffee or cafe",
    },
    nowIso
  );

  assert.equal(proposed.nextStatus, "not_planned");
  assert.equal(proposed.proposerId, "u_alice");
  assert.equal(proposed.slot1, slotA);
  assert.equal(proposed.slot2, slotB);
  assert.equal(proposed.venueText, "Coffee or cafe");
  assert.equal(proposed.scheduledAt, null);
  assert.equal(proposed.selectedSlot, null);
  assert.ok(proposed.notifyPartnerText);
  assert.ok(!proposed.notifyPartnerText.includes("—"));

  // 2. Partner Selects
  const recordAfterProposal: MatchDateRecord = {
    match_id: "m1",
    status: proposed.nextStatus,
    scheduled_at: proposed.scheduledAt,
    checked_in_at: proposed.checkedInAt,
    proposer_id: proposed.proposerId,
    slot_1: proposed.slot1,
    slot_2: proposed.slot2,
    venue_text: proposed.venueText,
  };

  const selected = computeDateTransition(
    recordAfterProposal,
    {
      type: "select",
      selectorId: "u_bob",
      selectedSlot: slotB,
    },
    "2026-10-10T13:00:00.000Z"
  );

  assert.equal(selected.nextStatus, "scheduled");
  assert.equal(selected.scheduledAt, slotB);
  assert.equal(selected.selectedSlot, slotB);
  assert.equal(selected.proposerId, "u_alice");
  assert.equal(selected.venueText, "Coffee or cafe");
  assert.ok(selected.notifyPartnerText);
  assert.ok(!selected.notifyPartnerText.includes("—"));

  // 3. Check-in compatibility: check-in preserves proposal fields
  const checkedIn = computeDateTransition(
    {
      ...recordAfterProposal,
      status: selected.nextStatus,
      scheduled_at: selected.scheduledAt,
      selected_slot: selected.selectedSlot,
    },
    {
      type: "check_in",
      status: "happened",
    },
    "2026-10-16T12:00:00.000Z"
  );

  assert.equal(checkedIn.nextStatus, "happened");
  assert.equal(checkedIn.scheduledAt, slotB);
  assert.equal(checkedIn.proposerId, "u_alice");
  assert.equal(checkedIn.venueText, "Coffee or cafe");
  assert.equal(checkedIn.selectedSlot, slotB);
  assert.ok(checkedIn.checkedInAt);
});
