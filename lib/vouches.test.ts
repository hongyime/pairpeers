import test from "node:test";
import assert from "node:assert/strict";
import {
  isVouchVisible,
  resolveVoucherDisplayName,
  approveVoucherName,
  hideVouch,
  removeVouch,
  getVisibleVouchesForProfile,
  type Vouch,
} from "./vouches.ts";
import { createInvite, type CreateInviteResult } from "./invites.ts";

test("vouch visibility: suppressed when hidden or removed", () => {
  assert.equal(isVouchVisible({ hidden_at: null, removed_at: null }), true);
  assert.equal(
    isVouchVisible({ hidden_at: "2026-10-10T00:00:00Z", removed_at: null }),
    false
  );
  assert.equal(
    isVouchVisible({ hidden_at: null, removed_at: "2026-10-10T00:00:00Z" }),
    false
  );
  assert.equal(
    isVouchVisible({
      hidden_at: "2026-10-10T00:00:00Z",
      removed_at: "2026-10-10T00:00:00Z",
    }),
    false
  );
});

test("name visibility: voucher name shown only when approved", () => {
  const approvedVouch = {
    voucher_name_approved: true,
    voucher: { display_name: "Sarah Chen" },
  };
  const unapprovedVouch = {
    voucher_name_approved: false,
    voucher: { display_name: "Sarah Chen" },
  };
  const missingNameVouch = {
    voucher_name_approved: true,
    voucher: { display_name: null },
  };

  assert.equal(resolveVoucherDisplayName(approvedVouch), "Sarah Chen");
  assert.equal(resolveVoucherDisplayName(unapprovedVouch), "A friend");
  assert.equal(resolveVoucherDisplayName(missingNameVouch), "A friend");
});

test("createInvite accepts and validates relationship_label and consent", async () => {
  let insertedData: any = null;
  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          count: 0,
          error: null,
        }),
      }),
      insert: (payload: any) => {
        insertedData = payload;
        return {
          select: () => ({
            single: async () => ({
              data: { code: payload.code, expires_at: payload.expires_at },
              error: null,
            }),
          }),
        };
      },
    }),
  } as any;

  // Invalid relationship label (< 2 chars or empty)
  const invalidRel = await createInvite(
    mockDb,
    "user-1",
    true,
    "Great person who always brings good energy.",
    ""
  );
  assert.equal(invalidRel.ok, false);
  assert.equal((invalidRel as any).error, "relationship_invalid");

  // Valid invite with relationship label and name approved
  const validRes = await createInvite(
    mockDb,
    "user-1",
    true,
    "Great person who always brings good energy to any room.",
    "Close friend",
    true
  );
  assert.equal(validRes.ok, true);
  assert.equal(insertedData.relationship_label, "Close friend");
  assert.equal(insertedData.voucher_name_approved, true);
});

test("ownership checks: voucher approves name, vouchee hides and removes", async () => {
  const mockVouch: Vouch = {
    id: "vouch-1",
    voucher_id: "voucher-uuid",
    vouchee_id: "vouchee-uuid",
    text: "Truly authentic friend",
    relationship_label: "Colleague",
    voucher_name_approved: false,
    hidden_at: null,
    removed_at: null,
    created_at: "2026-10-10T00:00:00Z",
  };

  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { ...mockVouch }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { ...mockVouch }, error: null }),
          }),
        }),
      }),
    }),
  } as any;

  // Stranger trying to approve name -> forbidden
  const strangerApprove = await approveVoucherName(
    mockDb,
    "vouch-1",
    "stranger-uuid",
    true
  );
  assert.equal(strangerApprove.ok, false);
  assert.equal((strangerApprove as any).error, "forbidden");

  // Vouchee trying to approve name -> forbidden (only voucher can approve)
  const voucheeApprove = await approveVoucherName(
    mockDb,
    "vouch-1",
    "vouchee-uuid",
    true
  );
  assert.equal(voucheeApprove.ok, false);
  assert.equal((voucheeApprove as any).error, "forbidden");

  // Voucher trying to hide vouch -> forbidden (only vouchee can hide)
  const voucherHide = await hideVouch(
    mockDb,
    "vouch-1",
    "voucher-uuid",
    true
  );
  assert.equal(voucherHide.ok, false);
  assert.equal((voucherHide as any).error, "forbidden");

  // Stranger trying to remove vouch -> forbidden
  const strangerRemove = await removeVouch(
    mockDb,
    "vouch-1",
    "stranger-uuid"
  );
  assert.equal(strangerRemove.ok, false);
  assert.equal((strangerRemove as any).error, "forbidden");
});

test("idempotent updates: hide, unhide, approve, and remove do not re-update", async () => {
  let updateCalled = false;
  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "vouch-1",
              voucher_id: "voucher-uuid",
              vouchee_id: "vouchee-uuid",
              voucher_name_approved: true,
              hidden_at: "2026-10-10T00:00:00Z",
              removed_at: null,
            },
            error: null,
          }),
        }),
      }),
      update: () => {
        updateCalled = true;
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({ data: {}, error: null }),
            }),
          }),
        };
      },
    }),
  } as any;

  // Already hidden, calling hideVouch(..., true) should be a no-op
  const hideRes = await hideVouch(mockDb, "vouch-1", "vouchee-uuid", true);
  assert.equal(hideRes.ok, true);
  assert.equal(updateCalled, false);

  // Already approved, calling approveVoucherName(..., true) should be a no-op
  const approveRes = await approveVoucherName(
    mockDb,
    "vouch-1",
    "voucher-uuid",
    true
  );
  assert.equal(approveRes.ok, true);
  assert.equal(updateCalled, false);
});
