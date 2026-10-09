export const SESSION_COOKIE = "pp_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Minimal signed session token: `<telegramId>.<expiryUnix>.<hmacHex>`.
 * Stateless — no server-side store needed for the pilot. The HMAC binds the
 * token to SESSION_SECRET; tampering invalidates the signature.
 *
 * Uses Web Crypto (crypto.subtle) instead of node:crypto so this module runs
 * in the Edge runtime (middleware) as well as Node route handlers.
 */
async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(
  telegramId: number,
  secret: string
): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const body = `${telegramId}.${expiry}`;
  const sig = await hmacHex(secret, body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<{ telegramId: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, expiryStr, sig] = parts;
  const telegramId = Number(idStr);
  const expiry = Number(expiryStr);
  if (!Number.isInteger(telegramId) || !Number.isInteger(expiry)) return null;
  if (Math.floor(Date.now() / 1000) > expiry) return null;

  const expected = await hmacHex(secret, `${idStr}.${expiryStr}`);
  // Constant-time comparison to avoid signature-oracle timing leaks.
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (diff !== 0) return null;
  return { telegramId };
}
