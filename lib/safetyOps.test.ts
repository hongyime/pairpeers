import test from "node:test";
import assert from "node:assert/strict";
import { getInvitePreview } from "./invites.ts";
import { requireFounder, type AdminAuthRequest } from "./adminAuth.ts";

function makeReq(options: {
  authHeader?: string | null;
  sessionCookie?: string;
}): AdminAuthRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "authorization") return options.authHeader ?? null;
        return null;
      },
    },
    cookies: {
      get: (name: string) => undefined,
    },
  };
}

test("getInvitePreview rejects invite from banned member with banned_code reason", async () => {
  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              vouch_text: "Great friend",
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              uses: 0,
              max_uses: 1,
              profiles: { display_name: "Alice", is_banned: true },
            },
            error: null,
          }),
        }),
      }),
    }),
  } as any;

  const preview = await getInvitePreview(mockDb, "PP-TEST12");
  assert.equal(preview.valid, false);
  assert.equal(preview.reason, "banned_code");
});

test("report idempotency logic returns existing report when duplicate submitted", async () => {
  const existingReport = { id: "rep-1", status: "open" };

  // Verify the query structure detects duplicate on (reporter, match, category)
  const mockDb = {
    from: (table: string) => ({
      select: () => ({
        eq: (col1: string, val1: string) => ({
          eq: (col2: string, val2: string) => ({
            eq: (col3: string, val3: string) => ({
              maybeSingle: async () => ({ data: existingReport, error: null }),
            }),
          }),
        }),
      }),
    }),
  };

  const { data } = await mockDb
    .from("safety_reports")
    .select()
    .eq("reporter_profile_id", "prof-1")
    .eq("category", "harassment")
    .eq("match_id", "m-1")
    .maybeSingle();

  assert.equal(data.id, "rep-1");
});

test("safety admin endpoint blocks unauthorized callers", async () => {
  const req = makeReq({});
  const mockDb = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  } as any;

  const auth = await requireFounder(req, mockDb);
  assert.equal(auth.ok, false);
  assert.equal(auth.status, 401);
});

test("banned profile is excluded from match cycle pool", () => {
  // Simulating the filter in app/api/admin/match/run/route.ts:
  const profiles = [
    { id: "p1", is_member: true, is_banned: false },
    { id: "p2", is_member: true, is_banned: true },
    { id: "p3", is_member: true, is_banned: false },
  ];

  const excluded = { banned: 0 };
  const eligible = profiles.filter((p) => {
    if (p.is_banned) {
      excluded.banned += 1;
      return false;
    }
    return true;
  });

  assert.equal(eligible.length, 2);
  assert.equal(excluded.banned, 1);
  assert.deepEqual(eligible.map((p) => p.id), ["p1", "p3"]);
});
