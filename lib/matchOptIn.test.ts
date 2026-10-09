import test from "node:test";
import assert from "node:assert/strict";
import {
  computeOptInTransition,
  buildNotificationText,
  type MatchRecord,
} from "./matchOptIn.ts";

const BASE_URL = "https://pairpeers.hong-yi.me";

function makeMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: "match-123",
    status: "pending",
    a_id: "user-a",
    b_id: "user-b",
    cycle_started_at: new Date("2026-10-10T00:00:00Z"),
    ...overrides,
  };
}

test("rejects non-participants with 403", () => {
  const match = makeMatch();
  const res = computeOptInTransition(match, "intruder-c", "accept", [], {
    now: new Date("2026-10-10T01:00:00Z"),
  });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error, "not_a_participant");
    assert.equal(res.status, 403);
  }
});

test("rejects pending match older than 72 hours with match_expired", () => {
  const match = makeMatch({
    cycle_started_at: new Date("2026-10-01T00:00:00Z"),
  });
  const res = computeOptInTransition(match, "user-a", "accept", [], {
    now: new Date("2026-10-05T00:00:00Z"), // > 72 hours
  });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error, "match_expired");
    assert.equal(res.status, 400);
  }
});

test("first accept records response and notifies the other member", () => {
  const match = makeMatch();
  const now = new Date("2026-10-10T02:00:00Z");
  const res = computeOptInTransition(match, "user-a", "accept", [], {
    now,
    baseUrl: BASE_URL,
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.noop, false);
    assert.equal(res.nextMatchStatus, "pending");
    assert.deepEqual(res.responseToRecord, {
      profileId: "user-a",
      response: "accepted",
    });
    assert.equal(res.notifications.length, 1);
    assert.equal(res.notifications[0].recipientProfileId, "user-b");
    assert.equal(res.notifications[0].type, "one_accepted");
    assert.ok(res.notifications[0].text.includes("waiting on you"));
  }
});

test("re-accept by the same user is an idempotent no-op", () => {
  const match = makeMatch();
  const existing = [{ profile_id: "user-a", response: "accepted" as const }];
  const res = computeOptInTransition(match, "user-a", "accept", existing, {
    now: new Date("2026-10-10T02:00:00Z"),
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.noop, true);
    assert.equal(res.nextMatchStatus, "pending");
    assert.equal(res.notifications.length, 0);
  }
});

test("second accept marks match accepted and notifies both participants", () => {
  const match = makeMatch();
  const existing = [{ profile_id: "user-a", response: "accepted" as const }];
  const res = computeOptInTransition(match, "user-b", "accept", existing, {
    now: new Date("2026-10-10T03:00:00Z"),
    baseUrl: BASE_URL,
    sharedInterests: ["cafe-hopping", "film and cinema"],
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.noop, false);
    assert.equal(res.nextMatchStatus, "accepted");
    assert.deepEqual(res.responseToRecord, {
      profileId: "user-b",
      response: "accepted",
    });
    assert.equal(res.notifications.length, 2);
    const recipients = res.notifications.map((n) => n.recipientProfileId);
    assert.ok(recipients.includes("user-a"));
    assert.ok(recipients.includes("user-b"));

    for (const notif of res.notifications) {
      assert.equal(notif.type, "both_accepted");
      assert.ok(notif.text.includes("You both accepted"));
      assert.ok(notif.text.includes("Safety note:"));
      assert.ok(!notif.text.includes("—"));
    }
  }
});

test("either declines marks match declined and notifies other tactfully", () => {
  const match = makeMatch();
  const res = computeOptInTransition(match, "user-a", "decline", [], {
    now: new Date("2026-10-10T02:00:00Z"),
    baseUrl: BASE_URL,
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.noop, false);
    assert.equal(res.nextMatchStatus, "declined");
    assert.deepEqual(res.responseToRecord, {
      profileId: "user-a",
      response: "declined",
    });
    assert.equal(res.notifications.length, 1);
    assert.equal(res.notifications[0].recipientProfileId, "user-b");
    assert.equal(res.notifications[0].type, "declined");
    assert.ok(res.notifications[0].text.includes("next cycle"));
    assert.ok(!res.notifications[0].text.includes("—"));
  }
});

test("re-decline on declined match is an idempotent no-op", () => {
  const match = makeMatch({ status: "declined" });
  const existing = [{ profile_id: "user-a", response: "declined" as const }];
  const res = computeOptInTransition(match, "user-a", "decline", existing, {
    now: new Date("2026-10-10T02:00:00Z"),
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.noop, true);
    assert.equal(res.nextMatchStatus, "declined");
    assert.equal(res.notifications.length, 0);
  }
});

test("all notification copy contains zero em dashes", () => {
  const one = buildNotificationText("one_accepted", BASE_URL);
  const both = buildNotificationText("both_accepted", BASE_URL, "Start with a fun question.");
  const dec = buildNotificationText("declined", BASE_URL);

  for (const text of [one, both, dec]) {
    assert.ok(!text.includes("—"), `Notification text must not contain em dash: ${text}`);
  }
});
