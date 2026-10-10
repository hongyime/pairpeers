import test from "node:test";
import assert from "node:assert/strict";
import { logEvent, computeFounderMetrics } from "./events.ts";

test("logEvent inserts event with scoped idempotency key", async () => {
  let insertedRow: any = null;
  const mockDb = {
    from: () => ({
      insert: async (row: any) => {
        insertedRow = row;
        return { error: null };
      },
    }),
  };

  const res = await logEvent({
    supabase: mockDb,
    eventType: "invite_redeemed",
    actorProfileId: "prof-123",
    targetId: "code-abc",
  });

  assert.equal(res.logged, true);
  assert.equal(insertedRow.event_type, "invite_redeemed");
  assert.equal(insertedRow.actor_profile_id, "prof-123");
  assert.equal(insertedRow.idempotency_key, "prof-123:invite_redeemed:code-abc");
});

test("logEvent suppresses duplicate key error idempotently", async () => {
  const mockDb = {
    from: () => ({
      insert: async () => ({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      }),
    }),
  };

  const res = await logEvent({
    supabase: mockDb,
    eventType: "questionnaire_completed",
    actorProfileId: "prof-1",
  });

  assert.equal(res.logged, false);
  assert.equal(res.skipped, true);
});

test("logEvent handles exceptions without throwing (non-blocking)", async () => {
  const mockDb = {
    from: () => {
      throw new Error("DB connection timeout");
    },
  };

  const res = await logEvent({
    supabase: mockDb,
    eventType: "match_accepted",
    actorProfileId: "prof-1",
  });

  assert.equal(res.logged, false);
  assert.ok(res.error);
});

test("computeFounderMetrics calculates aggregate math accurately", () => {
  const metrics = computeFounderMetrics({
    profilesCount: 10,
    membersCount: 8,
    questionnairesCount: 6,
    matches: [
      { id: "m1", status: "accepted" },
      { id: "m2", status: "accepted" },
      { id: "m3", status: "declined" },
      { id: "m4", status: "expired" },
      { id: "m5", status: "pending" },
    ],
    feedback: [
      { id: "f1", would_meet_again: true },
      { id: "f2", would_meet_again: true },
      { id: "f3", would_meet_again: false },
    ],
    dates: [
      { status: "scheduled" },
      { status: "happened" },
      { status: "skipped" },
    ],
    reportsCount: 1,
    cycles: [
      {
        id: "c1",
        started_at: "2026-10-01T00:00:00Z",
        audit: { pool_size: 8, pairs: [{ a: 1, b: 2 }], algorithm_path: "stable-roommates" },
      },
    ],
  });

  // Funnel: 6 questionnaires / 8 members = 0.75
  assert.equal(metrics.funnel.totalProfiles, 10);
  assert.equal(metrics.funnel.members, 8);
  assert.equal(metrics.funnel.questionnaireCompleted, 6);
  assert.equal(metrics.funnel.completionRate, 0.75);

  // Matches: 2 accepted, 1 declined, 1 expired = 4 resolved.
  // Acceptance rate = 2 / 4 = 0.5 (50%)
  assert.equal(metrics.matches.total, 5);
  assert.equal(metrics.matches.accepted, 2);
  assert.equal(metrics.matches.declined, 1);
  assert.equal(metrics.matches.expired, 1);
  assert.equal(metrics.matches.pending, 1);
  assert.equal(metrics.matches.resolved, 4);
  assert.equal(metrics.matches.acceptanceRate, 0.5);

  // Feedback: 3 responses, 2 would meet again = 2/3 ≈ 0.6667
  // Max possible feedback = 2 accepted matches * 2 = 4. Response rate = 3 / 4 = 0.75
  assert.equal(metrics.feedback.total, 3);
  assert.equal(metrics.feedback.wouldMeetAgain, 2);
  assert.equal(Math.round(metrics.feedback.meetAgainRate * 100), 67);
  assert.equal(metrics.feedback.responseRate, 0.75);

  // Dates:
  assert.equal(metrics.dates.scheduled, 1);
  assert.equal(metrics.dates.happened, 1);
  assert.equal(metrics.dates.skipped, 1);

  // Safety:
  assert.equal(metrics.safety.totalReports, 1);

  // Cycles:
  assert.equal(metrics.cycles.length, 1);
  assert.equal(metrics.cycles[0].poolSize, 8);
  assert.equal(metrics.cycles[0].pairCount, 1);
  assert.equal(metrics.cycles[0].algorithm, "stable-roommates");
});
