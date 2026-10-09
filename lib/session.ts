import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pp_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Minimal signed session token: `<telegramId>.<expiryUnix>.<hmacHex>`.
 * Stateless — no server-side store needed for the pilot. The HMAC binds the
 * token to SESSION_SECRET; tampering invalidates the signature.
 */
export function createSessionToken(telegramId: number, secret: string): string {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const body = `${telegramId}.${expiry}`;
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function verifySessionToken(
  token: string,
  secret: string
): { telegramId: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, expiryStr, sig] = parts;
  const telegramId = Number(idStr);
  const expiry = Number(expiryStr);
  if (!Number.isInteger(telegramId) || !Number.isInteger(expiry)) return null;
  if (Math.floor(Date.now() / 1000) > expiry) return null;

  const expected = createHmac("sha256", secret)
    .update(`${idStr}.${expiryStr}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { telegramId };
}
