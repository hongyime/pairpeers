import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const REDIRECT_STATE_COOKIE = "pp_tg_oauth_state";
export const REDIRECT_VERIFIER_COOKIE = "pp_tg_oauth_verifier";
const OAUTH_TTL_SECONDS = 5 * 60;

/**
 * Starts the Telegram OIDC redirect flow (authorization code + PKCE).
 * See https://core.telegram.org/bots/telegram-login
 *
 * Fallback for environments where the popup flow is unreliable (popup
 * blockers, in-app browsers, installed iOS PWAs). Generates a CSRF `state`
 * and a PKCE verifier, stores both in httpOnly cookies, and redirects the
 * browser to Telegram's authorization endpoint.
 *
 * NOTE: the redirect_uri must be registered EXACTLY in BotFather
 * (bot → Login Widget → Redirect URIs), e.g.
 * https://pairpeers.hong-yi.me/api/auth/telegram/callback
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(64).toString("hex"); // 128 chars, within PKCE 43–128
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  // Canonical base URL: Telegram requires the redirect_uri to be
  // pre-registered exactly in BotFather, so it must not vary per host.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/telegram/callback`;
  const authUrl = new URL("https://oauth.telegram.org/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(authUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/api/auth/telegram",
    maxAge: OAUTH_TTL_SECONDS,
  } as const;
  res.cookies.set(REDIRECT_STATE_COOKIE, state, cookieOpts);
  res.cookies.set(REDIRECT_VERIFIER_COOKIE, verifier, cookieOpts);
  return res;
}
