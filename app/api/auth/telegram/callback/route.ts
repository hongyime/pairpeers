import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from "@/lib/session";
import { verifyTelegramIdToken, telegramUserSummary } from "@/lib/telegram";
import { ensureProfile } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  REDIRECT_STATE_COOKIE,
  REDIRECT_VERIFIER_COOKIE,
  OAUTH_NEXT_COOKIE,
  isValidNextPath,
} from "../redirect/route";

const TOKEN_URL = "https://oauth.telegram.org/token";
const COOKIE_PATH = "/api/auth/telegram";

function clearOAuthCookies(res: NextResponse): void {
  res.cookies.delete({ name: REDIRECT_STATE_COOKIE, path: COOKIE_PATH });
  res.cookies.delete({ name: REDIRECT_VERIFIER_COOKIE, path: COOKIE_PATH });
  res.cookies.delete({ name: OAUTH_NEXT_COOKIE, path: "/" });
}

function fail(req: NextRequest, error: string): NextResponse {
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("error", error);
  const res = NextResponse.redirect(login);
  // Consume the one-time OAuth cookies even on failure.
  clearOAuthCookies(res);
  return res;
}

/** Constant-time comparison for the CSRF state token. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Canonical app base URL for the OAuth redirect_uri. Telegram requires the
 * redirect_uri to be pre-registered exactly in BotFather, so it must not
 * vary per request host — fall back to the request origin for local dev.
 */
function appBaseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}

/**
 * Handles the Telegram OIDC redirect back from oauth.telegram.org/auth.
 * Validates `state` (CSRF), exchanges the code for tokens with the client
 * secret (Basic auth), verifies the id_token, establishes the session,
 * and sends the user to the questionnaire.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID;
  const clientSecret = process.env.TELEGRAM_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !sessionSecret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail(req, "access_denied");
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail(req, "missing_code");

  // CSRF check: state must match what we issued to this browser.
  const expectedState = req.cookies.get(REDIRECT_STATE_COOKIE)?.value;
  const verifier = req.cookies.get(REDIRECT_VERIFIER_COOKIE)?.value;
  if (!expectedState || !verifier || !safeEqual(state, expectedState)) {
    return fail(req, "state_mismatch");
  }

  // Exchange the code for tokens (server-side; secret never leaves here).
  const redirectUri = `${appBaseUrl(req)}/api/auth/telegram/callback`;
  let tokenRes: Response;
  try {
    tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization:
          "Basic " +
          Buffer.from(
            `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`
          ).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });
  } catch {
    return fail(req, "token_exchange_failed");
  }
  if (!tokenRes.ok) return fail(req, "token_exchange_failed");

  let idToken: unknown;
  try {
    ({ id_token: idToken } = await tokenRes.json());
  } catch {
    return fail(req, "token_exchange_failed");
  }
  if (typeof idToken !== "string" || !idToken) return fail(req, "missing_id_token");

  let payload;
  try {
    payload = await verifyTelegramIdToken(idToken, clientId);
  } catch {
    return fail(req, "invalid_token");
  }

  // TODO: upsert the user into Supabase `profiles` (keyed on telegram_id = payload.id).
  const user = telegramUserSummary(payload);

  // One Telegram identity = one profile, forever (Sybil defense).
  try {
    const supabase = await createSupabaseServerClient();
    await ensureProfile(supabase, payload.id, user.name ?? user.username);
  } catch {
    return fail(req, "db_error");
  }

  const done = req.nextUrl.clone();
  const nextPath = req.cookies.get(OAUTH_NEXT_COOKIE)?.value;
  done.pathname = isValidNextPath(nextPath) ? nextPath : "/questionnaire";
  done.search = "";
  const res = NextResponse.redirect(done);
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
  clearOAuthCookies(res);
  return res;
}
