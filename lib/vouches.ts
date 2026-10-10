import type { SupabaseClient } from "@supabase/supabase-js";

export type Vouch = {
  id: string;
  voucher_id: string;
  vouchee_id: string;
  text: string;
  relationship_label: string | null;
  voucher_name_approved: boolean;
  hidden_at: string | null;
  removed_at: string | null;
  created_at: string;
  voucher?: {
    display_name: string | null;
  } | null;
};

export type VisibleVouch = {
  id: string;
  text: string;
  relationship_label: string | null;
  voucher_name: string;
  voucher_name_approved: boolean;
  created_at: string;
};

/**
 * Visibility rule: a vouch is suppressed if either hidden or removed.
 */
export function isVouchVisible(vouch: {
  hidden_at: string | null;
  removed_at: string | null;
}): boolean {
  return vouch.hidden_at === null && vouch.removed_at === null;
}

/**
 * Name visibility rule: the voucher's display name is shown only when
 * explicitly approved by the voucher. Otherwise it renders anonymously as "A friend".
 */
export function resolveVoucherDisplayName(vouch: {
  voucher_name_approved: boolean;
  voucher?: { display_name: string | null } | null;
}): string {
  if (vouch.voucher_name_approved && vouch.voucher?.display_name?.trim()) {
    return vouch.voucher.display_name.trim();
  }
  return "A friend";
}

/**
 * Loads visible vouches for a vouchee's profile, suppressing hidden and removed entries.
 */
export async function getVisibleVouchesForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<VisibleVouch[]> {
  const { data, error } = await supabase
    .from("vouches")
    .select(
      "id, text, relationship_label, voucher_name_approved, hidden_at, removed_at, created_at, voucher:profiles!vouches_voucher_id_fkey(display_name)"
    )
    .eq("vouchee_id", profileId)
    .is("hidden_at", null)
    .is("removed_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    text: row.text,
    relationship_label: row.relationship_label ?? null,
    voucher_name: resolveVoucherDisplayName(row),
    voucher_name_approved: Boolean(row.voucher_name_approved),
    created_at: row.created_at,
  }));
}

/**
 * Lists received vouches for the vouchee management surface.
 * Excludes permanently removed vouches, but includes hidden ones so the member can manage them.
 */
export async function listVoucheeVouches(
  supabase: SupabaseClient,
  voucheeProfileId: string
): Promise<Vouch[]> {
  const { data, error } = await supabase
    .from("vouches")
    .select(
      "id, voucher_id, vouchee_id, text, relationship_label, voucher_name_approved, hidden_at, removed_at, created_at, voucher:profiles!vouches_voucher_id_fkey(display_name)"
    )
    .eq("vouchee_id", voucheeProfileId)
    .is("removed_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any) ?? [];
}

/**
 * Lists vouches given by a voucher, so they can review and manage name consent.
 */
export async function listVoucherVouches(
  supabase: SupabaseClient,
  voucherProfileId: string
): Promise<Vouch[]> {
  const { data, error } = await supabase
    .from("vouches")
    .select(
      "id, voucher_id, vouchee_id, text, relationship_label, voucher_name_approved, hidden_at, removed_at, created_at"
    )
    .eq("voucher_id", voucherProfileId)
    .is("removed_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any) ?? [];
}

export type VouchMutationResult =
  | { ok: true; vouch?: Vouch }
  | { ok: false; error: "not_found" | "forbidden" | "invalid_state" };

/**
 * Approves or revokes display of the voucher's name.
 * Strictly caller-owned by the voucher. Idempotent.
 */
export async function approveVoucherName(
  supabase: SupabaseClient,
  vouchId: string,
  voucherProfileId: string,
  approved: boolean
): Promise<VouchMutationResult> {
  const { data: existing, error: fetchErr } = await supabase
    .from("vouches")
    .select("id, voucher_id, voucher_name_approved, removed_at")
    .eq("id", vouchId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.voucher_id !== voucherProfileId) return { ok: false, error: "forbidden" };
  if (existing.removed_at !== null) return { ok: false, error: "invalid_state" };

  if (existing.voucher_name_approved === approved) {
    return { ok: true };
  }

  const { data: updated, error: updateErr } = await supabase
    .from("vouches")
    .update({ voucher_name_approved: approved })
    .eq("id", vouchId)
    .select()
    .single();

  if (updateErr) throw updateErr;
  return { ok: true, vouch: updated as Vouch };
}

/**
 * Hides or unhides a received vouch.
 * Strictly caller-owned by the vouchee. Idempotent.
 */
export async function hideVouch(
  supabase: SupabaseClient,
  vouchId: string,
  voucheeProfileId: string,
  hide: boolean
): Promise<VouchMutationResult> {
  const { data: existing, error: fetchErr } = await supabase
    .from("vouches")
    .select("id, vouchee_id, hidden_at, removed_at")
    .eq("id", vouchId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.vouchee_id !== voucheeProfileId) return { ok: false, error: "forbidden" };
  if (existing.removed_at !== null) return { ok: false, error: "invalid_state" };

  const isCurrentlyHidden = existing.hidden_at !== null;
  if (isCurrentlyHidden === hide) {
    return { ok: true };
  }

  const hidden_at = hide ? new Date().toISOString() : null;
  const { data: updated, error: updateErr } = await supabase
    .from("vouches")
    .update({ hidden_at })
    .eq("id", vouchId)
    .select()
    .single();

  if (updateErr) throw updateErr;
  return { ok: true, vouch: updated as Vouch };
}

/**
 * Removes a received vouch permanently from active views.
 * Strictly caller-owned by the vouchee. Idempotent.
 */
export async function removeVouch(
  supabase: SupabaseClient,
  vouchId: string,
  voucheeProfileId: string
): Promise<VouchMutationResult> {
  const { data: existing, error: fetchErr } = await supabase
    .from("vouches")
    .select("id, vouchee_id, removed_at")
    .eq("id", vouchId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.vouchee_id !== voucheeProfileId) return { ok: false, error: "forbidden" };

  if (existing.removed_at !== null) {
    return { ok: true };
  }

  const { data: updated, error: updateErr } = await supabase
    .from("vouches")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", vouchId)
    .select()
    .single();

  if (updateErr) throw updateErr;
  return { ok: true, vouch: updated as Vouch };
}
