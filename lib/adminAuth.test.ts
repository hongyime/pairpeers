import test from "node:test";
import assert from "node:assert/strict";
import { requireFounder, type AdminAuthRequest } from "./adminAuth.ts";
import { createSessionToken, SESSION_COOKIE } from "./session.ts";

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
      get: (name: string) => {
        if (name === SESSION_COOKIE && options.sessionCookie) {
          return { value: options.sessionCookie };
        }
        return undefined;
      },
    },
  };
}

function mockSupabase(profile: any) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: null }),
        }),
      }),
    }),
  } as any;
}

test("returns 503 not_configured when service role key is absent", async () => {
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const req = makeReq({});
    const res = await requireFounder(req);
    assert.equal(res.ok, false);
    assert.equal(res.error, "not_configured");
    assert.equal(res.status, 503);
  } finally {
    if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
  }
});

test("authenticates successfully via valid CRON_SECRET", async () => {
  const origCron = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "secret_cron_123";
    const req = makeReq({ authHeader: "Bearer secret_cron_123" });
    const mockDb = mockSupabase(null);
    const res = await requireFounder(req, mockDb);
    assert.equal(res.ok, true);
    assert.equal(res.cron, true);
    assert.equal(res.profile, null);
  } finally {
    process.env.CRON_SECRET = origCron;
  }
});

test("returns 401 unauthorized when unauthenticated and without cron secret", async () => {
  const req = makeReq({});
  const mockDb = mockSupabase(null);
  const res = await requireFounder(req, mockDb);
  assert.equal(res.ok, false);
  assert.equal(res.error, "unauthorized");
  assert.equal(res.status, 401);
});

test("returns 401 unauthorized when session token is invalid or tampered", async () => {
  process.env.SESSION_SECRET = "test_secret_32_characters_minimum_len";
  const req = makeReq({ sessionCookie: "bad.token.signature" });
  const mockDb = mockSupabase(null);
  const res = await requireFounder(req, mockDb);
  assert.equal(res.ok, false);
  assert.equal(res.error, "unauthorized");
  assert.equal(res.status, 401);
});

test("returns 403 forbidden when user profile is not a founder", async () => {
  process.env.SESSION_SECRET = "test_secret_32_characters_minimum_len";
  const token = await createSessionToken(12345, process.env.SESSION_SECRET);
  const req = makeReq({ sessionCookie: token });
  const nonFounderProfile = { id: "p-1", telegram_id: 12345, is_founder: false };
  const mockDb = mockSupabase(nonFounderProfile);

  const res = await requireFounder(req, mockDb);
  assert.equal(res.ok, false);
  assert.equal(res.error, "forbidden");
  assert.equal(res.status, 403);
});

test("returns success when user profile is a founder", async () => {
  process.env.SESSION_SECRET = "test_secret_32_characters_minimum_len";
  const token = await createSessionToken(99999, process.env.SESSION_SECRET);
  const req = makeReq({ sessionCookie: token });
  const founderProfile = { id: "founder-1", telegram_id: 99999, is_founder: true };
  const mockDb = mockSupabase(founderProfile);

  const res = await requireFounder(req, mockDb);
  assert.equal(res.ok, true);
  assert.equal(res.cron, false);
  assert.equal(res.profile?.id, "founder-1");
});
