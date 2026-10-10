import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeExportData,
  deleteAccount,
  type RawExportInput,
} from "./accountData.ts";

test("export excludes partner private data and partner questionnaire answers", () => {
  const input: RawExportInput = {
    profile: {
      id: "user-1",
      display_name: "Alice",
      telegram_username: "alice_tg",
      created_at: "2026-10-01T00:00:00Z",
      is_member: true,
    },
    questionnaire: {
      identity: "woman",
      seeking: "men",
      interests: ["coffee", "books"],
    },
    invites: [
      {
        code: "PP-ABC123",
        uses: 1,
        max_uses: 1,
        expires_at: "2026-10-04T00:00:00Z",
        created_at: "2026-10-01T00:00:00Z",
        vouch_text: "Great friend",
      },
    ],
    vouchesGiven: [
      {
        text: "Bob is a wonderful human",
        created_at: "2026-10-02T00:00:00Z",
      },
    ],
    vouchesReceived: [
      {
        text: "Alice is brilliant",
        created_at: "2026-10-01T00:00:00Z",
        voucher: { display_name: "Charlie" },
      },
    ],
    matches: [
      {
        id: "m-100",
        status: "accepted",
        accepted_at: "2026-10-05T00:00:00Z",
        match_cycles: { started_at: "2026-10-04T00:00:00Z" },
        date: { status: "happened" },
        my_response: "accepted",
        my_feedback: { would_meet_again: true, note: "Enjoyed it" },
      },
    ],
  };

  const exported = sanitizeExportData(input);

  // Profile data is present
  assert.equal(exported.profile.id, "user-1");
  assert.equal(exported.profile.display_name, "Alice");

  // Own questionnaire is present
  assert.deepEqual(exported.questionnaire, {
    identity: "woman",
    seeking: "men",
    interests: ["coffee", "books"],
  });

  // Verify match data contains only own perspective
  assert.equal(exported.matches.length, 1);
  const matchExport = exported.matches[0];
  assert.equal(matchExport.id, "m-100");
  assert.equal(matchExport.my_response, "accepted");
  assert.equal(matchExport.my_feedback?.would_meet_again, true);

  // Verify partner private fields are completely absent
  assert.equal((matchExport as any).partner_id, undefined);
  assert.equal((matchExport as any).partner_answers, undefined);
  assert.equal((matchExport as any).partner_contact, undefined);
  assert.equal((matchExport as any).partner_feedback, undefined);
});

test("deletion leaves partner match record and partner data intact", async () => {
  let profileRow = {
    id: "user-1",
    telegram_id: 11111111,
    display_name: "Alice",
    telegram_username: "alice_tg",
    is_member: true,
    deleted_at: null as string | null,
  };

  let questionnaireRow: any = {
    profile_id: "user-1",
    answers: { interests: ["coffee"] },
  };

  const partnerMatchRow = {
    id: "m-100",
    a_id: "user-1",
    b_id: "partner-2",
    status: "accepted",
  };

  const mockDb = {
    rpc: async () => ({ data: null, error: new Error("function does not exist") }),
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => {
            if (table === "profiles" && val === "user-1") {
              return { data: profileRow, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (patch: any) => ({
        eq: (_col: string, val: string) => {
          if (table === "profiles" && val === "user-1") {
            profileRow = { ...profileRow, ...patch };
          }
          if (table === "questionnaire_responses" && val === "user-1") {
            questionnaireRow = { ...questionnaireRow, ...patch };
          }
          return { error: null };
        },
      }),
    }),
  };

  const res = await deleteAccount(mockDb, "user-1");
  assert.equal(res.ok, true);

  // User profile is scrubbed and tombstoned
  assert.ok(profileRow.deleted_at);
  assert.equal(profileRow.display_name, "Former Member");
  assert.equal(profileRow.telegram_username, null);
  assert.equal(profileRow.is_member, false);
  assert.ok(profileRow.telegram_id < 0, "telegram_id scrambled to negative value");

  // User questionnaire answers are wiped
  assert.deepEqual(questionnaireRow.answers, {});

  // Partner match record remained untouched (not cascade deleted)
  assert.equal(partnerMatchRow.id, "m-100");
  assert.equal(partnerMatchRow.b_id, "partner-2");
  assert.equal(partnerMatchRow.status, "accepted");
});

test("repeat deletion is idempotent", async () => {
  const profileRow = {
    id: "user-1",
    deleted_at: "2026-10-10T10:00:00Z",
  };

  const mockDb = {
    rpc: async () => ({ data: null, error: new Error("function does not exist") }),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profileRow, error: null }),
        }),
      }),
    }),
  };

  const res = await deleteAccount(mockDb, "user-1");
  assert.equal(res.ok, true);
  assert.equal(res.already_anonymized, true);
});

test("ownership boundaries: returns profile_not_found for unknown profile", async () => {
  const mockDb = {
    rpc: async () => ({ data: null, error: new Error("function does not exist") }),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  };

  const res = await deleteAccount(mockDb, "non-existent-user");
  assert.equal(res.ok, false);
  assert.equal(res.error, "profile_not_found");
});
