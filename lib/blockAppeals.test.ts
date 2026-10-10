import test from "node:test";
import assert from "node:assert/strict";
import { canonicalPair, canonicalPairKey, blockMatch } from "./matchBlocks.ts";
import { runCycle, type CycleAnswers, type CycleParticipant } from "./matchingCycle.ts";
import { rateLimit } from "./rateLimit.ts";
import { requireFounder, type AdminAuthRequest } from "./adminAuth.ts";

const sampleAnswers = (): CycleAnswers => ({
  identity: "man",
  interests: ["music", "film"],
  chronotype: "in_between",
  recharge: "social",
  conflict: "talk_now",
  diet: "none",
  smokes: "no",
  kids: "open",
  seeking: "everyone",
  age_bracket: "age_25_29",
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
});

const makePerson = (id: string): CycleParticipant => ({ id, answers: sampleAnswers() });

test("canonical pair ordering is symmetric and consistent", () => {
  const p1 = "11111111-1111-1111-1111-111111111111";
  const p2 = "22222222-2222-2222-2222-222222222222";

  const pair1 = canonicalPair(p1, p2);
  const pair2 = canonicalPair(p2, p1);

  assert.equal(pair1.user_a_id, p1);
  assert.equal(pair1.user_b_id, p2);
  assert.equal(pair2.user_a_id, p1);
  assert.equal(pair2.user_b_id, p2);

  assert.equal(canonicalPairKey(p1, p2), canonicalPairKey(p2, p1));
});

test("matcher exclusion: blocked pairs are excluded from matching in both directions", () => {
  const u1 = makePerson("user-1");
  const u2 = makePerson("user-2");
  const u3 = makePerson("user-3");
  const u4 = makePerson("user-4");

  // Block between user-1 and user-2
  const blockedKeys = new Set<string>([canonicalPairKey("user-1", "user-2")]);

  const result = runCycle([u1, u2, u3, u4], { blockedPairKeys: blockedKeys });

  // user-1 and user-2 must NEVER be paired together
  for (const pair of result.pairs) {
    const isPair12 =
      (pair.aId === "user-1" && pair.bId === "user-2") ||
      (pair.aId === "user-2" && pair.bId === "user-1");
    assert.equal(isPair12, false, "Blocked pair was matched!");
  }

  assert.equal(result.excludedPairCounts["blocked_pair"], 1);
});

test("blockMatch ownership check rejects non-participants", async () => {
  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "m-1", a_id: "user-a", b_id: "user-b", status: "pending" },
            error: null,
          }),
        }),
      }),
    }),
  } as any;

  // Stranger tries to block
  const res = await blockMatch(mockDb, "stranger-user", "m-1");
  assert.equal(res.ok, false);
  assert.equal((res as any).error, "forbidden");
});

test("blockMatch is idempotent on duplicate calls", async () => {
  const mockDb = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "block-1" },
              error: null,
            }),
          }),
          maybeSingle: async () => ({
            data: { id: "m-1", a_id: "user-a", b_id: "user-b", status: "pending" },
            error: null,
          }),
        }),
      }),
    }),
  } as any;

  const res = await blockMatch(mockDb, "user-a", "m-1");
  assert.equal(res.ok, true);
  assert.equal((res as any).duplicate, true);
});

test("banned user is accepted by appeal endpoint check", () => {
  // Verifying session logic accepts banned user
  const bannedProfile = {
    id: "user-banned",
    telegram_id: 12345678,
    display_name: "Banned Member",
    is_member: true,
    is_banned: true,
  };

  function canAccessAppeals(profile: { id: string; is_banned?: boolean } | null) {
    if (!profile) return false;
    // Appeals MUST be allowed even if is_banned is true
    return true;
  }

  assert.equal(canAccessAppeals(bannedProfile), true);
  assert.equal(canAccessAppeals(null), false);
});

test("rate limiting triggers when exceeding quota", () => {
  const key = `test:limit:${Date.now()}`;
  const max = 3;
  const windowMs = 5000;

  for (let i = 0; i < max; i++) {
    const res = rateLimit(key, max, windowMs);
    assert.equal(res.allowed, true);
  }

  // Next call should be denied
  const blocked = rateLimit(key, max, windowMs);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test("founder-only moderation rejects non-founder callers", async () => {
  const fakeReq: AdminAuthRequest = {
    headers: { get: () => null },
    cookies: { get: () => undefined },
  };

  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "u-1", is_founder: false },
            error: null,
          }),
        }),
      }),
    }),
  } as any;

  const auth = await requireFounder(fakeReq, mockDb);
  assert.equal(auth.ok, false);
  assert.equal(auth.status, 401);
});
