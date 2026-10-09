import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = "https://oauth.telegram.org";
const JWKS_URL = new URL("https://oauth.telegram.org/.well-known/jwks.json");

// Cached across warm invocations; jose handles key rotation via the set.
const JWKS = createRemoteJWKSet(JWKS_URL);

export type TelegramIdToken = {
  /** Numeric Telegram user ID — stable identity, same value the legacy widget returned as `id`. */
  id: number;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  nonce?: string;
};

/**
 * Verifies a Telegram OIDC id_token (popup or redirect flow).
 * See https://core.telegram.org/bots/telegram-login
 *
 * Checks: RS256/ES256 signature against Telegram's JWKS (pinned algorithms —
 * never "none" or symmetric), iss, aud == our Client ID, exp+iat present,
 * and a 1-hour max token age bounding the replay window.
 */
export async function verifyTelegramIdToken(
  idToken: string,
  clientId: string
): Promise<TelegramIdToken> {
  const verified = await jwtVerify(idToken, JWKS, {
    issuer: ISSUER,
    audience: clientId,
    algorithms: ["RS256", "ES256"],
    requiredClaims: ["exp", "iat"], // fail closed if Telegram ever omits them
    maxTokenAge: "1h",
  });
  const payload = verified.payload as TelegramIdToken;
  if (typeof payload.id !== "number" || !Number.isFinite(payload.id)) {
    throw new Error("missing_user_id");
  }
  return payload;
}

export function telegramUserSummary(payload: TelegramIdToken) {
  return {
    id: payload.id,
    name: payload.name ?? null,
    username: payload.preferred_username ?? null,
    photo_url: payload.picture ?? null,
  };
}
