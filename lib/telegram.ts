import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = "https://oauth.telegram.org";
const JWKS_URL = new URL("https://oauth.telegram.org/.well-known/jwks.json");

// Cached across warm invocations; jose handles key rotation via the set.
// Cached across warm invocations; jose handles key rotation via the set.
const JWKS = createRemoteJWKSet(JWKS_URL);

/** Telegram user IDs arrive as a JSON number or a decimal string. */
function toTelegramId(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return value;
  }
  if (typeof value === "string" && /^\d{1,19}$/.test(value)) {
    const n = Number(value);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return null;
}

export type TelegramIdToken = {
  /** Numeric Telegram user ID — stable identity, same value the legacy widget returned as `id`. */
  id: number;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  nonce?: string;
  /** OIDC standard claim; present when the `phone` scope was granted. */
  phone_number?: string;
  phone_number_verified?: boolean;
};

/**
 * Verifies a Telegram OIDC id_token (popup or redirect flow).
 * See https://core.telegram.org/bots/telegram-login
 *
 * Checks: RS256/ES256 signature against Telegram's JWKS (pinned algorithms —
 * never "none" or symmetric), iss, aud == our Client ID, exp+iat present,
 * and a 1-hour max token age bounding the replay window.
 *
 * When `expectedNonce` is provided, jose validates the token's `nonce` claim
 * during verification — keeping the replay check inside the library so a
 * caller can never accidentally skip it.
 */
export async function verifyTelegramIdToken(
  idToken: string,
  clientId: string,
  expectedNonce?: string
): Promise<TelegramIdToken> {
  const verified = await jwtVerify(idToken, JWKS, {
    issuer: ISSUER,
    audience: clientId,
    algorithms: ["RS256", "ES256"],
    requiredClaims: ["exp", "iat"], // fail closed if Telegram ever omits them
    maxTokenAge: "1h",
    ...(expectedNonce ? { nonce: expectedNonce } : {}),
  });
  const payload = verified.payload as TelegramIdToken;
  // NOTE: `sub` is an opaque OIDC subject, NOT the Telegram user id — the
  // numeric Telegram user id is the `id` claim (profile scope), sent as a
  // JSON number or decimal string.
  const telegramId = toTelegramId(payload.id);
  if (!telegramId) {
    console.error(
      `[auth] id_token missing usable id claim; claims: ${Object.keys(verified.payload).sort().join(",")}; id typeof: ${typeof (verified.payload as Record<string, unknown>).id}`
    );
    throw new Error("missing_user_id");
  }
  return { ...payload, id: telegramId };
}

export function telegramUserSummary(payload: TelegramIdToken) {
  return {
    id: payload.id,
    name: payload.name ?? null,
    username: payload.preferred_username ?? null,
    photo_url: payload.picture ?? null,
  };
}
