import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/session";
import { NONCE_COOKIE } from "./nonce/route";

const ISSUER = "https://oauth.telegram.org";
const JWKS_URL = new URL("https://oauth.telegram.org/.well-known/jwks.json");

// Cached across warm invocations; jose handles key rotation via the set.
const JWKS = createRemoteJWKSet(JWKS_URL);

type TelegramIdToken = {
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
 * Verifies a Telegram OIDC id_token from the telegram-login.js popup flow.
 * See https://core.telegram.org/bots/telegram-login
 *
 * Checks: RS256 signature against Telegram's JWKS, iss, aud == our Client ID,
 * expiry, and the nonce we issued for this browser session.
 */
export async function POST(req: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let idToken: unknown;
  try {
    ({ id_token: idToken } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
  }

  let payload: TelegramIdToken;
  try {
    const verified = await jwtVerify(idToken, JWKS, {
      issuer: ISSUER,
      audience: clientId,
      algorithms: ["RS256", "ES256"], // pinned — never accept "none" or symmetric algs
      requiredClaims: ["exp", "iat"], // fail closed if Telegram ever omits them
      maxTokenAge: "1h", // id_tokens are short-lived; bound the replay window
    });
    payload = verified.payload as TelegramIdToken;
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  // Replay protection: the token must carry the nonce we issued to this browser.
  // NOTE (accepted risk, pilot): nonce consumption is cookie deletion. Two
  // concurrent requests with the same token+nonce could both pass — but that
  // only lets a user double-submit their own login. A server-side one-time
  // nonce store is the hardening path if this ever matters.
  const expectedNonce = req.cookies.get(NONCE_COOKIE)?.value;
  if (!expectedNonce || payload.nonce !== expectedNonce) {
    return NextResponse.json({ error: "nonce_mismatch" }, { status: 401 });
  }

  // The numeric Telegram user ID is the stable identity key.
  if (typeof payload.id !== "number" || !Number.isFinite(payload.id)) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 401 });
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // TODO: upsert the user into Supabase `profiles` (keyed on telegram_id = payload.id).
  const user = {
    id: payload.id,
    name: payload.name ?? null,
    username: payload.preferred_username ?? null,
    photo_url: payload.picture ?? null,
  };

  const res = NextResponse.json({ ok: true, user });
  // Establish the session: signed, httpOnly, Secure, SameSite=Lax.
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(payload.id, sessionSecret),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    }
  );
  // Delete the one-time nonce with the same path it was set with.
  res.cookies.delete({ name: NONCE_COOKIE, path: "/api/auth/telegram" });
  return res;
}
