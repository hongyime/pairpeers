/**
 * Singapore phone validation for the pilot.
 * Telegram returns E.164 (e.g. "+6581234567"). SG numbers: +65 followed by
 * 8 digits starting with 3, 6, 8 or 9 (mobile 8/9, landline 6, newer 3-series).
 */

const SG_RE = /^\+65[3689]\d{7}$/;

/** Normalizes a phone string to E.164-ish digits (strips spaces/dashes). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function isSingaporePhone(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return SG_RE.test(normalizePhone(raw));
}

export type PhoneGateResult =
  | { ok: true; phone: string | null }
  | { ok: false; error: "non_sg_phone" };

/**
 * SG-only pilot rule on the verified id_token.
 * - phone_number present and SG → ok (normalized E.164 returned for storage)
 * - phone_number present but not SG → reject
 * - phone_number absent (user declined the checkbox, or Telegram uses a
 *   different claim) → allowed, but the claim names are logged so the
 *   delivery shape can be confirmed from server logs.
 */
export function phoneGate(
  payload: Record<string, unknown>,
  log: (msg: string) => void
): PhoneGateResult {
  const raw = payload.phone_number;
  if (typeof raw !== "string" || !raw) {
    log(
      `[auth] no phone_number claim; claims present: ${Object.keys(payload).sort().join(",")}`
    );
    return { ok: true, phone: null };
  }
  const phone = normalizePhone(raw);
  if (!isSingaporePhone(phone)) {
    return { ok: false, error: "non_sg_phone" };
  }
  return { ok: true, phone };
}
